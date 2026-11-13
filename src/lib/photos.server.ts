/**
 * Foto su Cloudflare R2 (bucket collegato al Worker come PHOTOS, vedi wrangler.jsonc).
 *
 * Nel database non salviamo più le immagini ma solo il loro indirizzo, "/foto/<chiave>": così
 * le foto non passano dalla banda (egress) di Supabase. Il Worker le serve da R2 con cache
 * permanente sulla rete Cloudflare (le chiavi non cambiano mai: una foto nuova = chiave nuova).
 *
 * Chiavi:  r/<uuid>.jpg            foto dei sassi
 *          f/<utente>/<uuid>.jpg   foto-prova dei ritrovamenti
 *          s/<utente>/<uuid>.jpg   foto delle segnalazioni "non c'è"
 *          a/<utente>/<uuid>.jpg   foto profilo
 * Le chiavi casuali non si possono indovinare: le foto-prova restano visibili solo a chi
 * conosce l'indirizzo, cioè chi l'ha scattata e gli admin (lo decide il database).
 *
 * Senza bucket (sviluppo in locale con Node) le foto restano nel database come prima.
 */

export const PHOTO_PREFIX = "/foto/";

type R2Object = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  arrayBuffer(): Promise<ArrayBuffer>;
};
type R2Bucket = {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ArrayBuffer | Uint8Array, options?: object): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{
    objects: Array<{ key: string }>;
    truncated: boolean;
    cursor?: string;
  }>;
};

let bucketPromise: Promise<R2Bucket | null> | undefined;

/** Il bucket R2, oppure null fuori da Cloudflare o se il collegamento PHOTOS manca. */
export function photoBucket(): Promise<R2Bucket | null> {
  // nitro (preset cloudflare-module) mette l'ambiente del Worker in globalThis.__env__
  const fromNitro = (globalThis as { __env__?: { PHOTOS?: R2Bucket } }).__env__?.PHOTOS;
  if (fromNitro) return Promise.resolve(fromNitro);
  bucketPromise ??= (async () => {
    try {
      // nome in una variabile: il bundler non deve cercare di risolvere il modulo del runtime
      const runtime = "cloudflare:workers";
      const mod = (await import(/* @vite-ignore */ runtime)) as { env?: { PHOTOS?: R2Bucket } };
      return mod.env?.PHOTOS ?? null;
    } catch {
      return null;
    }
  })();
  return bucketPromise;
}

export function isStoredPhoto(ref: string | null | undefined): ref is string {
  return typeof ref === "string" && ref.startsWith(PHOTO_PREFIX);
}

export function keyOf(ref: string) {
  return ref.slice(PHOTO_PREFIX.length);
}

function decodeDataUrl(dataUrl: string) {
  const match = /^data:(image\/[a-z+.-]+)(?:;[^,;]+)*;base64,(.+)$/is.exec(dataUrl.trim());
  if (!match) return null;
  return { contentType: match[1]!.toLowerCase(), bytes: Buffer.from(match[2]!, "base64") };
}

function extensionOf(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

/**
 * Salva una foto (data URL) in R2 e restituisce il suo indirizzo "/foto/…".
 * folder: "r", oppure "f/<utente>", "s/<utente>", "a/<utente>".
 * Se R2 non c'è, o se la foto è già un indirizzo, la restituisce invariata.
 */
export async function storePhoto(photo: string, folder: string): Promise<string> {
  const decoded = decodeDataUrl(photo);
  if (!decoded) return photo;
  const bucket = await photoBucket();
  if (!bucket) return photo;
  const key = `${folder}/${crypto.randomUUID()}.${extensionOf(decoded.contentType)}`;
  await bucket.put(key, decoded.bytes, {
    httpMetadata: { contentType: decoded.contentType, cacheControl: CACHE_FOREVER },
  });
  return PHOTO_PREFIX + key;
}

/** Foto come data URL (serve all'AI), sia che stia in R2, in un altro indirizzo o già inline. */
export async function photoAsDataUrl(ref: string): Promise<string | null> {
  if (ref.startsWith("data:")) return ref;
  if (isStoredPhoto(ref)) {
    const bucket = await photoBucket();
    const object = bucket ? await bucket.get(keyOf(ref)) : null;
    if (!object) return null;
    const type = object.httpMetadata?.contentType ?? "image/jpeg";
    return `data:${type};base64,${Buffer.from(await object.arrayBuffer()).toString("base64")}`;
  }
  if (/^https?:\/\//.test(ref)) {
    const res = await fetch(ref);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  }
  return null;
}

/** Cancella una foto salvata in R2 (le foto inline o altrove si ignorano). */
export async function deletePhoto(ref: string | null | undefined) {
  if (!isStoredPhoto(ref)) return;
  const bucket = await photoBucket();
  await bucket?.delete(keyOf(ref)).catch(() => undefined);
}

/** Cancella tutte le foto sotto un prefisso (es. "f/<utente>/" quando si elimina l'account). */
export async function deletePhotoFolder(prefix: string) {
  const bucket = await photoBucket();
  if (!bucket) return;
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, ...(cursor ? { cursor } : {}) });
    if (page.objects.length) await bucket.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

const CACHE_FOREVER = "public, max-age=31536000, immutable";

type Ctx = { waitUntil?: (p: Promise<unknown>) => void } | undefined;

/** GET /foto/<chiave>: la foto da R2, messa in cache sulla rete Cloudflare. */
export async function servePhoto(request: Request, ctx: Ctx): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Metodo non ammesso", { status: 405 });
  }
  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.slice(PHOTO_PREFIX.length));
  if (!/^[a-z]\/(?:[0-9a-f-]{36}\/)?[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(key)) {
    return new Response("Non trovata", { status: 404 });
  }
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(url.origin + url.pathname);
  const hit = await cache?.match(cacheKey);
  if (hit) return hit;

  const bucket = await photoBucket();
  const object = bucket ? await bucket.get(key) : null;
  if (!object) return new Response("Non trovata", { status: 404 });
  const response = new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "image/jpeg",
      "cache-control": CACHE_FOREVER,
      "x-content-type-options": "nosniff",
    },
  });
  if (cache) {
    const put = cache.put(cacheKey, response.clone()).catch(() => undefined);
    if (ctx?.waitUntil) ctx.waitUntil(put);
  }
  return response;
}
