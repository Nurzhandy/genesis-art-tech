// Адаптер Gemini (Google Gen AI SDK) под нейтральный интерфейс LlmLike.
import { GoogleGenAI } from '@google/genai';
import type { LlmLike, LlmRequest } from './analyzeDay';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export function toGeminiRequest(req: LlmRequest, model: string) {
  return {
    model,
    contents: [{
      role: 'user',
      parts: [
        ...req.images.map((img) => ({ inlineData: { mimeType: img.mediaType, data: img.base64 } })),
        { text: req.text },
      ],
    }],
    config: {
      systemInstruction: req.system,
      responseMimeType: 'application/json',
      responseJsonSchema: req.schema,
      temperature: 0.4,
    },
  };
}

export function createGemini(apiKey: string, model = DEFAULT_GEMINI_MODEL): LlmLike {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async generateJson(req) {
      const params = toGeminiRequest(req, model);
      const res = await ai.models.generateContent({
        ...params,
        config: { ...params.config, abortSignal: AbortSignal.timeout(45_000) },
      });
      if (res.promptFeedback?.blockReason) return null;
      return res.text ?? null;
    },
  };
}
