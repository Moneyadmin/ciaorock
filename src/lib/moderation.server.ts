import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

/** Controllo AI dei testi pubblici (nickname, bio, nome e indizio dei sassi). Solo lato server. */

const TextVerdict = z.object({ ok: z.boolean(), reason: z.string() });

export type TextKind = "nickname" | "bio" | "rock";

const CONTEXT: Record<TextKind, string> = {
  nickname: "il nickname pubblico di un giocatore",
  bio: "la biografia pubblica del profilo di un giocatore",
  rock: "il nome e l'indizio di un sasso dipinto nascosto (l'indizio descrive il nascondiglio in un luogo pubblico)",
};

export type TextCheck = { ok: true } | { ok: false; message: string };

const RULES =
  'Sei il moderatore di Ciao Rock, un gioco per ragazzi dai 14 ai 18 anni in cui si dipingono, nascondono e cercano sassi in luoghi pubblici. Valuti un testo che verrà mostrato agli altri giocatori. Rispondi SOLO con JSON con le chiavi "ok" (boolean) e "reason" (frase breve in italiano, rivolta al ragazzo, senza ripetere il testo). ' +
  "ok=false se il testo contiene: volgarità, insulti, bullismo o prese in giro di persone reali, contenuti sessuali, violenza, armi, droghe, alcol, odio o discriminazione; dati personali (numero di telefono, email, indirizzo di casa, nome e cognome completi, nome della propria scuola, profili social, link); pubblicità o spam; richieste di incontrarsi in privato o di scriversi fuori dall'app; un indizio che porta in un luogo privato o pericoloso (casa propria o di altri, cortili privati, binari, strade trafficate); contenuti che non c'entrano con il gioco. " +
  "Nomi di fantasia, emoji, battute innocue, descrizioni di parchi, piazze, panchine e altri luoghi pubblici vanno bene.";

/** Ultima difesa se l'AI non risponde: blocca almeno i dati di contatto e le parolacce più comuni. */
const CONTACT = [
  /(?:\+?\d[\s.-]?){8,}/, // numeri di telefono
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/i, // email
  /(?:https?:\/\/|www\.)\S+|\b\S+\.(?:com|it|net|org|io|me|ly|gg)\b/i, // link
  /(?:^|\s)@[a-z0-9_.]{3,}/i, // profili social
  /\b(?:instagram|insta|tiktok|snapchat|snap|telegram|whatsapp|discord)\b/i,
];
const BAD =
  /\b(?:cazz\w*|merd\w*|stronz\w*|puttan\w*|troi\w*|vaffanculo|fanculo|coglion\w*|minchi\w*|figa|fica|porco ?dio|dio ?(?:cane|porco)|negr[oi]|froci\w*|ricchion\w*|fuck\w*|shit|bitch\w*|nazis\w*|nazi|sesso|porn\w*)\b/i;

function localCheck(text: string): TextCheck {
  const flat = text.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (CONTACT.some((re) => re.test(flat))) {
    return {
      ok: false,
      message: "Testo non adatto: niente numeri di telefono, email, link o profili social.",
    };
  }
  if (BAD.test(flat))
    return { ok: false, message: "Testo non adatto: niente parolacce o insulti." };
  return { ok: true };
}

async function askModel(model: string, kind: TextKind, text: string) {
  const { createOpenRouter } = await import("./ai.server");
  const openrouter = createOpenRouter();
  if (!openrouter) throw new Error("OPENROUTER_API_KEY mancante");
  const result = streamText({
    model: openrouter(model),
    output: Output.object({ schema: TextVerdict }),
    prompt: `${RULES}\n\nTipo di testo: ${CONTEXT[kind]}.\n\nTesto:\n"""${text}"""`,
    providerOptions: { openrouter: { reasoning: { effort: "low" } } },
  });
  return result.output;
}

export async function checkText(kind: TextKind, text: string): Promise<TextCheck> {
  const local = localCheck(text);
  if (!local.ok) return local;

  const { TEXT_MODEL, VISION_MODEL } = await import("./ai.server");
  // prima il modello dei testi, poi quello delle foto (anche lui legge il testo)
  for (const model of [...new Set([TEXT_MODEL, VISION_MODEL])]) {
    try {
      const verdict = await askModel(model, kind, text);
      return verdict.ok
        ? { ok: true }
        : { ok: false, message: `Testo non adatto: ${verdict.reason}` };
    } catch (error) {
      const detail = NoObjectGeneratedError.isInstance(error)
        ? `risposta non valida: ${String(error.text ?? "").slice(0, 200)}`
        : error instanceof Error
          ? error.message
          : String(error);
      console.error(`checkText(${kind}) con ${model} non riuscito: ${detail}`);
    }
  }
  // AI non raggiungibile: non blocchiamo il gioco, resta il controllo locale già superato
  return { ok: true };
}
