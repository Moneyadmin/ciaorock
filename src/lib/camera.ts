/**
 * Mentre la fotocamera è aperta il telefono può chiudere il browser per liberare memoria: al
 * ritorno la pagina riparte da capo. Prima di aprirla segniamo cosa stava facendo il giocatore,
 * così dopo il ricaricamento lo riportiamo lì e gli suggeriamo di usare la galleria.
 */
const KEY = "ciaorock.camera-open";
const MAX_AGE_MS = 15 * 60_000;

export type CameraContext =
  { kind: "sheet"; rockId: string; mode: "find" | "move" | "report" } | { kind: "crea" };

export function markCameraOpen(context: CameraContext) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...context, at: Date.now() }));
  } catch {
    /* storage non disponibile: pazienza */
  }
}

export function clearCameraOpen() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* niente */
  }
}

/** Contesto rimasto aperto da prima del ricaricamento (letto una volta sola). */
export function takeInterruptedCamera(): CameraContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as CameraContext & { at: number };
    return Date.now() - value.at < MAX_AGE_MS ? value : null;
  } catch {
    return null;
  }
}

export const CAMERA_TIP =
  "Il telefono ha chiuso l'app mentre usavi la fotocamera (succede quando ha poca memoria). Scatta la foto con la fotocamera del telefono e poi scegli “Dalla galleria”.";
