import OpenAI from "openai";

// Perplexity API is OpenAI-compatible
export const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: "https://api.perplexity.ai"
});

// Pricing per million tokens (as of 2025)
export const PRICING = {
  "sonar": {
    input: 0.20,
    output: 0.20
  },
  "sonar-pro": {
    input: 3.00,
    output: 15.00
  },
  "sonar-reasoning": {
    input: 1.00,
    output: 5.00
  },
  "sonar-reasoning-pro": {
    input: 5.00,
    output: 15.00
  }
} as const;

export type PerplexityModel = keyof typeof PRICING;

export function calculateCost(model: PerplexityModel, promptTokens: number, completionTokens: number): number {
  const pricing = PRICING[model];
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
