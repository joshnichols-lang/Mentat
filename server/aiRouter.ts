import OpenAI from "openai";
import { storage } from "./storage";
import { decryptCredential } from "./encryption";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{
    type: "text" | "image_url";
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
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
  "grok-2-vision-1212": { input: 2.0, output: 10.0 }, // Grok 2 vision model
  "grok-4-fast-reasoning": { input: 0.20, output: 0.50 }, // < 128K tokens
  "grok-4-fast-non-reasoning": { input: 0.20, output: 0.50 }, // < 128K tokens
};

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = PRICING[model] || { input: 0, output: 0 };
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Get the user's active AI provider client
 * Falls back to shared platform key if user has no personal credentials
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
  
  // If user has no personal AI credentials, use shared platform key
  if (!apiKey) {
    // Try xAI (Grok) first, then fall back to Perplexity
    const sharedXaiKey = process.env.XAI_API_KEY;
    const sharedPerplexityKey = process.env.PERPLEXITY_API_KEY;
    
    if (sharedXaiKey) {
      // Use shared xAI/Grok key
      const client = new OpenAI({
        apiKey: sharedXaiKey,
        baseURL: "https://api.x.ai/v1",
      });
      
      return {
        client,
        providerName: "xai",
        apiKeyId: "shared-platform-key", // Special ID to indicate shared key usage
      };
    } else if (sharedPerplexityKey) {
      // Fall back to shared Perplexity key
      const client = new OpenAI({
        apiKey: sharedPerplexityKey,
        baseURL: "https://api.perplexity.ai",
      });
      
      return {
        client,
        providerName: "perplexity",
        apiKeyId: "shared-platform-key", // Special ID to indicate shared key usage
      };
    }
    
    throw new Error("No AI provider configured. Please add an AI provider in settings or contact admin.");
  }
  
  // User has personal credentials - decrypt and use them
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
      return "grok-4-fast-reasoning";
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
 * Get vision-capable model for provider
 */
function getVisionModel(providerName: string): string {
  switch (providerName) {
    case "openai":
      return "gpt-4o"; // Supports vision
    case "xai":
      return "grok-4-fast-reasoning"; // Vision-enabled reasoning model (10x cheaper than Grok 2)
    case "perplexity":
      return "sonar-pro"; // Use best available
    default:
      return getDefaultModel(providerName);
  }
}

/**
 * Check if request contains images
 */
function hasImages(messages: AIMessage[]): boolean {
  return messages.some(msg => 
    Array.isArray(msg.content) && 
    msg.content.some(part => part.type === "image_url")
  );
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
  
  // Check if request contains images - use vision model if so
  const containsImages = hasImages(request.messages);
  
  // Use provided model or default for the provider
  // If request contains images, use vision-capable model
  let model = request.model || (containsImages ? getVisionModel(providerName) : getDefaultModel(providerName));
  if (request.model && !isModelCompatible(request.model, providerName)) {
    console.warn(`Model ${request.model} incompatible with provider ${providerName}, using ${containsImages ? 'vision' : 'default'}: ${containsImages ? getVisionModel(providerName) : getDefaultModel(providerName)}`);
    model = containsImages ? getVisionModel(providerName) : getDefaultModel(providerName);
  }
  
  try {
    // Build request configuration
    const requestConfig: any = {
      model,
      messages: request.messages as any,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    };
    
    // Add Live Search capabilities for Grok 4 Fast via extra_body
    if (providerName === "xai") {
      requestConfig.extra_body = {
        search_parameters: {
          mode: "auto", // Let AI decide when to search
          return_citations: true,
          sources: [
            { type: "web" },
            { type: "news" }
          ]
        }
      };
      console.log("[AI Router] Enabled Grok Live Search with web and news sources");
    }
    
    const completion = await client.chat.completions.create(requestConfig);
    
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
