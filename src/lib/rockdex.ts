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

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** Compress a picked image to a small JPEG data URL (keeps rows light). */
export async function compressImage(file: File, maxSize = 1000, quality = 0.72) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Lettura file non riuscita"));
    reader.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Immagine non valida"));
      image.src = dataUrl;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
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
