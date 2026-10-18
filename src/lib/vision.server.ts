import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

/** Verifiche AI delle foto: usate dalle funzioni server (mai dal browser direttamente). */

export type RockPhotoCheck = {
  approved: boolean;
  message: string;
};

const Verdict = z.object({
  painted: z.boolean(),
  safe: z.boolean(),
  reason: z.string(),
});

const MatchVerdict = z.object({
  painted: z.boolean(),
  same: z.boolean(),
  safe: z.boolean(),
  reason: z.string(),
});

/** Regola comune: le foto di sassi e ritrovamenti non devono mostrare persone o dati personali. */
const SAFE_RULE =
  "safe=false se la foto mostra persone riconoscibili (volti, anche parziali) o parti del corpo oltre a mani e dita, nudità, violenza, armi, droghe, alcol, simboli d'odio, scritte volgari, oppure dati personali leggibili (targhe, numeri civici o indirizzi, nomi di scuole, documenti, schermi con messaggi). Mani che tengono il sasso, prati, strade, muri e panchine vanno bene.";
const NOT_SAFE =
  "Foto rifiutata: non deve mostrare persone, volti o dati personali (targhe, indirizzi, scuole). Rifalla inquadrando solo il sasso.";

function mediaTypeOf(dataUrl: string) {
  const end = dataUrl.indexOf(";");
  return end > 5 ? dataUrl.slice(5, end) : "image/jpeg";
}

/** La foto mostra un sasso con una faccia o un disegno dipinto? */
export async function checkPainted(photo: string): Promise<RockPhotoCheck> {
  const { createOpenRouter, VISION_MODEL } = await import("./ai.server");
  const openrouter = createOpenRouter();
  if (!openrouter) {
    return {
      approved: false,
      message: "Servizio di verifica non disponibile. Riprova più tardi.",
    };
  }

  try {
    const result = streamText({
      model: openrouter(VISION_MODEL),
      output: Output.object({ schema: Verdict }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Guarda la foto. Rispondi SOLO con JSON con esattamente le chiavi "painted" (boolean), "safe" (boolean) e "reason" (frase breve in italiano). painted=true solo se la foto mostra un sasso/pietra con una faccia dipinta o un disegno dipinto chiaramente visibile. ${SAFE_RULE}`,
            },
            {
              type: "file",
              mediaType: mediaTypeOf(photo),
              data: photo,
            },
          ],
        },
      ],
    });

    const verdict = await result.output;
    if (!verdict.safe) return { approved: false, message: NOT_SAFE };
    return {
      approved: verdict.painted,
      message: verdict.painted
        ? `Sasso dipinto approvato: ${verdict.reason}`
        : `Foto rifiutata: ${verdict.reason} Carica una foto nitida di un sasso con la faccia o il disegno dipinto.`,
    };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return {
        approved: false,
        message: "Non ho capito la foto. Riprova con un'immagine più nitida.",
      };
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("429")) {
      return {
        approved: false,
        message: "Troppe verifiche in poco tempo: riprova tra qualche istante.",
      };
    }
    if (message.includes("402")) {
      return {
        approved: false,
        message: "Crediti AI esauriti: la verifica foto non è disponibile.",
      };
    }
    return { approved: false, message: "Verifica della foto non riuscita. Riprova." };
  }
}

/** La foto-prova mostra lo stesso sasso dipinto della foto di riferimento? */
export async function checkSameRock(photo: string, reference: string): Promise<RockPhotoCheck> {
  const { createOpenRouter, VISION_MODEL } = await import("./ai.server");
  const openrouter = createOpenRouter();
  if (!openrouter) {
    return {
      approved: false,
      message: "Servizio di verifica non disponibile. Riprova più tardi.",
    };
  }

  try {
    const result = streamText({
      model: openrouter(VISION_MODEL),
      output: Output.object({ schema: MatchVerdict }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                'Ti mostro due foto. IMMAGINE 1 = foto originale del sasso registrato. IMMAGINE 2 = foto appena scattata dal giocatore. Rispondi SOLO con JSON con esattamente le chiavi "painted" (boolean), "same" (boolean), "safe" (boolean, riferito a IMMAGINE 2) e "reason" (frase breve in italiano). painted=true solo se IMMAGINE 2 mostra un sasso con una faccia o un disegno dipinto. same=true solo se il sasso dipinto in IMMAGINE 2 è lo STESSO sasso di IMMAGINE 1: confronta il disegno (soggetto, colori, forma del sasso). Se i disegni sono diversi (per esempio una faccina felice contro una spada) same=false. Ignora differenze di luce, sfondo, angolo o distanza. ' +
                SAFE_RULE,
            },
            { type: "text", text: "IMMAGINE 1 (originale):" },
            { type: "file", mediaType: mediaTypeOf(reference), data: reference },
            { type: "text", text: "IMMAGINE 2 (foto-prova):" },
            { type: "file", mediaType: mediaTypeOf(photo), data: photo },
          ],
        },
      ],
    });

    const verdict = await result.output;
    if (!verdict.safe) return { approved: false, message: NOT_SAFE };
    if (!verdict.painted) {
      return {
        approved: false,
        message: `Foto rifiutata: ${verdict.reason} Scatta una foto nitida del sasso dipinto.`,
      };
    }
    if (!verdict.same) {
      return {
        approved: false,
        message: `Non è lo stesso sasso: ${verdict.reason} Scatta la foto del sasso mostrato nell'indizio.`,
      };
    }
    return { approved: true, message: `Sasso riconosciuto: ${verdict.reason}` };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return {
        approved: false,
        message: "Non ho capito la foto. Riprova con un'immagine più nitida.",
      };
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("429")) {
      return {
        approved: false,
        message: "Troppe verifiche in poco tempo: riprova tra qualche istante.",
      };
    }
    if (message.includes("402")) {
      return {
        approved: false,
        message: "Crediti AI esauriti: la verifica foto non è disponibile.",
      };
    }
    return { approved: false, message: "Verifica della foto non riuscita. Riprova." };
  }
}

const AvatarVerdict = z.object({ ok: z.boolean(), reason: z.string() });

/** La foto profilo è adatta a un'app per ragazzi dai 12 ai 18 anni? */
export async function checkAvatar(photo: string): Promise<RockPhotoCheck> {
  const { createOpenRouter, VISION_MODEL } = await import("./ai.server");
  const openrouter = createOpenRouter();
  if (!openrouter) {
    return { approved: false, message: "Controllo della foto non disponibile. Riprova più tardi." };
  }
  try {
    const result = streamText({
      model: openrouter(VISION_MODEL),
      output: Output.object({ schema: AvatarVerdict }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'È la foto profilo di un\'app di gioco per ragazzi dai 14 ai 18 anni. Rispondi SOLO con JSON con le chiavi "ok" (boolean) e "reason" (frase breve in italiano, rivolta al ragazzo). ok=false se la foto contiene nudità o contenuti sessuali, violenza, sangue, armi, droghe, alcol o fumo, simboli d\'odio, gesti o scritte volgari o offensive, oppure dati personali leggibili (numeri di telefono, indirizzi, targhe, nomi di scuole). Selfie, animali, disegni, paesaggi e sassi dipinti vanno bene.',
            },
            { type: "file", mediaType: mediaTypeOf(photo), data: photo },
          ],
        },
      ],
    });
    const verdict = await result.output;
    return verdict.ok
      ? { approved: true, message: "Foto approvata." }
      : { approved: false, message: `Foto non adatta: ${verdict.reason}` };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return { approved: false, message: "Non ho capito la foto. Riprova con un'altra immagine." };
    }
    return { approved: false, message: "Controllo della foto non riuscito. Riprova." };
  }
}
