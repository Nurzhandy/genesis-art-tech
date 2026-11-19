// Адаптер Gemini (Google Gen AI SDK) под нейтральный интерфейс LlmLike.
import { GoogleGenAI } from '@google/genai';
import type { LlmLike, LlmRequest } from './analyzeDay';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
/** Запасные модели на случай перегрузки основной (503 «high demand»). */
export const FALLBACK_GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];

const isOverload = (e: unknown) => {
  const status = (e as { status?: number })?.status;
  const msg = String((e as Error)?.message ?? e);
  return status === 503 || status === 429 || /\b(503|429)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|aborted|timeout/i.test(msg);
};

/** Пробуем модели по очереди: перегрузка или таймаут → следующая; иная ошибка — сразу наружу. */
export async function withModelFallback<T>(
  models: string[],
  call: (model: string, signal: AbortSignal) => Promise<T>,
  { budgetMs, perTryMs }: { budgetMs: number; perTryMs: number },
): Promise<T> {
  const deadline = Date.now() + budgetMs;
  let last: unknown = new Error('Нет моделей');
  for (const model of models) {
    const left = deadline - Date.now();
    if (left <= 500) break;
    try {
      return await call(model, AbortSignal.timeout(Math.min(perTryMs, left)));
    } catch (e) {
      if (!isOverload(e)) throw e;
      console.warn(`gemini: ${model} перегружена или не ответила, пробую следующую`);
      last = e;
    }
  }
  throw last;
}

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
  const models = [model, ...FALLBACK_GEMINI_MODELS.filter((m) => m !== model)];
  return {
    generateJson: (req) => withModelFallback(models, async (m, signal) => {
      const params = toGeminiRequest(req, m);
      const res = await ai.models.generateContent({ ...params, config: { ...params.config, abortSignal: signal } });
      if (res.promptFeedback?.blockReason) return null;
      return res.text ?? null;
    }, { budgetMs: 42_000, perTryMs: 20_000 }),
  };
}
