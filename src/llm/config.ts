export const LLM_TIER_VALUES = ["standard", "safe", "creative"] as const;

export type LlmTier = (typeof LLM_TIER_VALUES)[number];

export interface LlmRuntimeConfig {
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey?: string;
  llmTier: LlmTier;
  llmMaxSteps: number;
  llmTemperature: number;
  chatPort: number;
}

export const DEFAULT_LLM_BASE_URL = "http://127.0.0.1:11434/v1";
export const DEFAULT_LLM_MODEL = "qwen2.5:3b";
export const DEFAULT_LLM_TIER: LlmTier = "safe";
export const DEFAULT_LLM_MAX_STEPS = 8;
export const DEFAULT_LLM_TEMPERATURE = 0.4;
export const DEFAULT_CHAT_PORT = 4142;
export const MAX_LLM_MAX_STEPS = 32;

function boundedNumber(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  integer: boolean,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = Math.min(max, Math.max(min, parsed));
  return integer ? Math.trunc(bounded) : bounded;
}

function parseTier(value: string | undefined): LlmTier {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "safe" || normalized === "standard" || normalized === "creative") {
    return normalized;
  }
  return DEFAULT_LLM_TIER;
}

export function loadLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmRuntimeConfig {
  const apiKey = env.ABLETON_MIND_LLM_API_KEY?.trim();
  return {
    llmBaseUrl: env.ABLETON_MIND_LLM_BASE_URL?.trim() || DEFAULT_LLM_BASE_URL,
    llmModel: env.ABLETON_MIND_LLM_MODEL?.trim() || DEFAULT_LLM_MODEL,
    ...(apiKey ? { llmApiKey: apiKey } : {}),
    llmTier: parseTier(env.ABLETON_MIND_LLM_TIER),
    llmMaxSteps: boundedNumber(
      env.ABLETON_MIND_LLM_MAX_STEPS,
      DEFAULT_LLM_MAX_STEPS,
      1,
      MAX_LLM_MAX_STEPS,
      true,
    ),
    llmTemperature: boundedNumber(
      env.ABLETON_MIND_LLM_TEMPERATURE,
      DEFAULT_LLM_TEMPERATURE,
      0,
      2,
      false,
    ),
    chatPort: boundedNumber(env.ABLETON_MIND_CHAT_PORT, DEFAULT_CHAT_PORT, 1, 65535, true),
  };
}
