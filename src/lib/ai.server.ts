import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** Modello usato per controllare le foto dei sassi (deve accettare immagini). */
export const VISION_MODEL = process.env["AI_VISION_MODEL"] || "google/gemini-3.6-flash";
/** Modello usato per assegnare i punti ai nascondigli e leggere i commenti. */
export const TEXT_MODEL = process.env["AI_TEXT_MODEL"] || "openai/gpt-6-astra";

/** Provider OpenRouter (API compatibile OpenAI). Restituisce null se manca OPENROUTER_API_KEY. */
export function createOpenRouter() {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) return null;
  return createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    supportsStructuredOutputs: true,
    headers: {
      "HTTP-Referer": process.env["PUBLIC_SITE_URL"] || "https://ciaorock.com",
      "X-Title": "Ciao Rock",
    },
  });
}
