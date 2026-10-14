import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Quando l'AI approva una foto, il server rilascia un "gettone" firmato legato a utente,
 * sasso e contenuto della foto. Alla conferma (ritrovamento, nuovo sasso, spostamento) il
 * server accetta il gettone invece di rifare la verifica AI: una sola chiamata AI per foto
 * e nessun modo di saltare il controllo dal browser.
 */

type Kind = "paint" | "match";
type Payload = { k: Kind; u: string; r: string | null; h: string; e: number };

const TTL_MS = 2 * 60 * 60 * 1000;

function secret() {
  const value = process.env["PHOTO_TOKEN_SECRET"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!value) throw new Error("PHOTO_TOKEN_SECRET (o SUPABASE_SERVICE_ROLE_KEY) mancante.");
  return value;
}

export function photoHash(photo: string) {
  return createHash("sha256").update(photo).digest("base64url");
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function issuePhotoToken(kind: Kind, userId: string, rockId: string | null, photo: string) {
  const payload: Payload = {
    k: kind,
    u: userId,
    r: rockId,
    h: photoHash(photo),
    e: Date.now() + TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function checkPhotoToken(
  token: string | null | undefined,
  kind: Kind,
  userId: string,
  rockId: string | null,
  photo: string,
) {
  if (!token) return false;
  const [body, mac] = token.split(".");
  if (!body || !mac) return false;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    return (
      p.k === kind &&
      p.u === userId &&
      p.r === rockId &&
      p.e > Date.now() &&
      p.h === photoHash(photo)
    );
  } catch {
    return false;
  }
}
