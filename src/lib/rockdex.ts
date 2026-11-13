export type Difficulty = "Facile" | "Media" | "Difficile";

export const DIFFICULTIES: Difficulty[] = ["Facile", "Media", "Difficile"];

export type RockSummary = {
  id: string;
  name: string;
  clue: string;
  lat: number;
  lng: number;
  difficulty: string;
  creator: string;
  hider: string | null;
  move_count: number;
  created_at: string;
  found_count: number;
};

export type RockDetail = RockSummary & { photo: string };

export type FoundRock = {
  id: string;
  found_at: string;
  photo: string;
  city: string | null;
  region: string | null;
  country: string | null;
  continent: string | null;
  rock: { id: string; name: string; clue: string; photo: string; creator: string } | null;
};

export type Profile = {
  id: string;
  nickname: string;
  bio: string;
  streak_current: number;
  streak_best: number;
};

export const DEFAULT_POSITION = { lat: 41.9032, lng: 12.4964 };

export { metersBetween as distanceMeters } from "@/lib/rules";

export function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/**
 * Riduce la foto scelta a un JPEG leggero (lato massimo maxSize). Le foto dei telefoni sono da
 * 12–50 megapixel: decodificarle a piena risoluzione (e farne prima una stringa base64) occupa
 * centinaia di MB e sui telefoni con poca memoria fa crashare la pagina. Qui il browser decodifica
 * direttamente alla dimensione ridotta quando può, e il file originale non viene mai copiato.
 */
export async function compressImage(file: File, maxSize = 1000, quality = 0.72) {
  let source: ImageBitmap | HTMLImageElement | null = null;
  let url: string | null = null;
  try {
    if (typeof createImageBitmap === "function") {
      try {
        // prima lettura solo per conoscere le proporzioni, poi decodifica già ridotta
        const probe = await createImageBitmap(file);
        const { width, height } = probe;
        probe.close();
        const scale = Math.min(1, maxSize / Math.max(width, height));
        source = await createImageBitmap(file, {
          resizeWidth: Math.max(1, Math.round(width * scale)),
          resizeHeight: Math.max(1, Math.round(height * scale)),
          resizeQuality: "high",
          imageOrientation: "from-image",
        });
      } catch {
        source = null;
      }
    }
    if (!source) {
      url = URL.createObjectURL(file);
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Immagine non valida"));
        image.src = url!;
      });
    }
    const w = "naturalWidth" in source ? source.naturalWidth : source.width;
    const h = "naturalHeight" in source ? source.naturalHeight : source.height;
    const scale = Math.min(1, maxSize / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Immagine non valida");
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL("image/jpeg", quality);
    canvas.width = canvas.height = 0; // libera subito la memoria del disegno
    return out;
  } finally {
    if (source && "close" in source) source.close();
    if (url) URL.revokeObjectURL(url);
  }
}

/** High-accuracy GPS reading, with a longer timeout for woods / weak signal. */
export function getPrecisePosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("GPS non disponibile"));
      return;
    }
    let best: GeolocationPosition | null = null;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        if (pos.coords.accuracy <= 12) finish();
      },
      (err) => {
        navigator.geolocation.clearWatch(watch);
        clearTimeout(timer);
        if (best) finish();
        else reject(new Error(err.message));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );

    const timer = setTimeout(() => finish(), 9000);

    function finish() {
      clearTimeout(timer);
      navigator.geolocation.clearWatch(watch);
      if (!best) {
        reject(new Error("Posizione non rilevata"));
        return;
      }
      resolve({
        lat: best.coords.latitude,
        lng: best.coords.longitude,
        accuracy: Math.round(best.coords.accuracy),
      });
    }
  });
}

/** Ritaglia al centro un quadrato e lo riduce (foto profilo leggera, ~30–60 KB). */
export async function squareAvatar(file: File, size = 320, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Immagine non valida"));
      image.src = url;
    });
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Immagine non valida");
    ctx.drawImage(
      img,
      (img.width - side) / 2,
      (img.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
