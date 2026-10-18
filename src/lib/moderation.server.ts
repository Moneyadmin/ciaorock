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

export async function checkText(kind: TextKind, text: string): Promise<TextCheck> {
  const { createOpenRouter, TEXT_MODEL } = await import("./ai.server");
  const openrouter = createOpenRouter();
  if (!openrouter)
    return { ok: false, message: "Controllo del testo non disponibile. Riprova più tardi." };
  try {
    const result = streamText({
      model: openrouter(TEXT_MODEL),
      output: Output.object({ schema: TextVerdict }),
      messages: [
        {
          role: "system",
          content:
            'Sei il moderatore di Ciao Rock, un gioco per ragazzi dai 14 ai 18 anni in cui si dipingono, nascondono e cercano sassi in luoghi pubblici. Valuti un testo che verrà mostrato agli altri giocatori. Rispondi SOLO con JSON con le chiavi "ok" (boolean) e "reason" (frase breve in italiano, rivolta al ragazzo, senza ripetere il testo). ' +
            "ok=false se il testo contiene: volgarità, insulti, bullismo o prese in giro di persone reali, contenuti sessuali, violenza, armi, droghe, alcol, odio o discriminazione; dati personali (numero di telefono, email, indirizzo di casa, nome e cognome completi, nome della propria scuola, profili social, link); pubblicità o spam; richieste di incontrarsi in privato o di scriversi fuori dall'app; un indizio che porta in un luogo privato o pericoloso (casa propria o di altri, cortili privati, binari, strade trafficate); contenuti che non c'entrano con il gioco. " +
            "Nomi di fantasia, emoji, battute innocue, descrizioni di parchi, piazze, panchine e altri luoghi pubblici vanno bene.",
        },
        { role: "user", content: `Tipo di testo: ${CONTEXT[kind]}.\n\nTesto:\n"""${text}"""` },
      ],
    });
    const verdict = await result.output;
    return verdict.ok
      ? { ok: true }
      : { ok: false, message: `Testo non adatto: ${verdict.reason}` };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return { ok: false, message: "Non sono riuscito a controllare il testo. Riprova." };
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("429")) {
      return { ok: false, message: "Troppi controlli in poco tempo: riprova tra qualche istante." };
    }
    return { ok: false, message: "Controllo del testo non riuscito. Riprova." };
  }
}
