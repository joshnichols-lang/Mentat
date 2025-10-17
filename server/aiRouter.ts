import OpenAI from "openai";
import { storage } from "./storage";
import { decryptCredential } from "./encryption";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface AICompletionResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string; // Actual provider name (perplexity, openai, xai)
  cost: number; // Cost in USD
}

// Pricing per 1M tokens (input/output)
const PRICING: Record<string, { input: number; output: number }> = {
  // Perplexity Sonar models
  "sonar": { input: 1.0, output: 1.0 },
  "sonar-pro": { input: 3.0, output: 15.0 },
  "sonar-reasoning": { input: 1.0, output: 5.0 },
  "sonar-reasoning-pro": { input: 5.0, output: 15.0 },
  
  // OpenAI models
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  
  // xAI Grok models
  "grok-beta": { input: 5.0, output: 15.0 },
  "grok-vision-beta": { input: 5.0, output: 15.0 },
};

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = PRICING[model] || { input: 0, output: 0 };
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Get the user's active AI provider client
 */
async function getAIClient(userId: string, preferredProvider?: string): Promise<{ client: OpenAI; providerName: string; apiKeyId: string }> {
  // Try to get the preferred provider or fall back to first active AI key
  let apiKey;
  
  if (preferredProvider) {
    apiKey = await storage.getActiveApiKeyByProvider(userId, "ai", preferredProvider);
  }
  
  if (!apiKey) {
    // Fall back to any active AI provider
    const allAiKeys = await storage.getApiKeysByProvider(userId, "ai", "");
    apiKey = allAiKeys.find(key => key.isActive === 1);
  }
  
  if (!apiKey) {
    throw new Error("No AI provider configured. Please add an AI provider in settings.");
  }
  
  // Decrypt the API key
  const decryptedKey = decryptCredential(
    apiKey.encryptedApiKey,
    apiKey.apiKeyIv,
    apiKey.encryptedDek,
    apiKey.dekIv
  );
  
  // Determine the API base URL based on provider
  let baseURL: string;
  switch (apiKey.providerName) {
    case "perplexity":
      baseURL = "https://api.perplexity.ai";
      break;
    case "openai":
      baseURL = "https://api.openai.com/v1";
      break;
    case "xai":
      baseURL = "https://api.x.ai/v1";
      break;
    default:
      throw new Error(`Unsupported AI provider: ${apiKey.providerName}`);
  }
  
  // Create OpenAI client (all providers use OpenAI-compatible API)
  const client = new OpenAI({
    apiKey: decryptedKey,
    baseURL,
  });
  
  return {
    client,
    providerName: apiKey.providerName,
    apiKeyId: apiKey.id,
  };
}

/**
 * Get default model for a provider
 */
function getDefaultModel(providerName: string): string {
  switch (providerName) {
    case "perplexity":
      return "sonar";
    case "openai":
      return "gpt-4o-mini";
    case "xai":
      return "grok-beta";
    default:
      return "sonar";
  }
}

/**
 * Check if a model is compatible with a provider
 */
function isModelCompatible(model: string, providerName: string): boolean {
  const lowerModel = model.toLowerCase();
  
  switch (providerName) {
    case "perplexity":
      return lowerModel.includes("sonar");
    case "openai":
      return lowerModel.includes("gpt");
    case "xai":
      return lowerModel.includes("grok");
    default:
      return false;
  }
}

/**
 * Make an AI completion request using the user's configured AI provider
 */
export async function makeAIRequest(
  userId: string,
  request: AICompletionRequest,
  preferredProvider?: string
): Promise<AICompletionResponse> {
  const { client, providerName, apiKeyId } = await getAIClient(userId, preferredProvider);
  
  // Use provided model or default for the provider
  // If provided model is incompatible with provider, use default
  let model = request.model || getDefaultModel(providerName);
  if (request.model && !isModelCompatible(request.model, providerName)) {
    console.warn(`Model ${request.model} incompatible with provider ${providerName}, using default: ${getDefaultModel(providerName)}`);
    model = getDefaultModel(providerName);
  }
  
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: request.messages as any,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    });
    
    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("No response from AI provider");
    }
    
    const usage = {
      promptTokens: completion.usage?.prompt_tokens || 0,
      completionTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
    };
    
    const cost = calculateCost(model, usage.promptTokens, usage.completionTokens);
    
    // Update last used timestamp for the API key
    await storage.updateApiKeyLastUsed(userId, apiKeyId);
    
    return {
      content,
      usage,
      model,
      provider: providerName,
      cost,
    };
  } catch (error: any) {
    console.error(`AI request failed for provider ${providerName}:`, error);
    // Attach provider info to error for better logging
    const errorWithProvider = new Error(`AI request failed: ${error.message}`);
    (errorWithProvider as any).provider = providerName;
    (errorWithProvider as any).model = model;
    throw errorWithProvider;
  }
}

/**
 * Get list of user's AI providers
 */
export async function getUserAIProviders(userId: string) {
  const aiKeys = await storage.getApiKeysByProvider(userId, "ai", "");
  
  return aiKeys.map(key => ({
    id: key.id,
    providerName: key.providerName,
    label: key.label,
    isActive: key.isActive === 1,
    lastUsed: key.lastUsed,
  }));
}
