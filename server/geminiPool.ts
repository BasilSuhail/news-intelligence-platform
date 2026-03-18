/**
 * Gemini API Key Pool - Rotates between multiple API keys
 * to distribute load and avoid rate limits across agents
 */

import fs from "fs";
import path from "path";

// Load environment variables from .env file
function loadEnvKeys(): string[] {
  const envPath = path.join(process.cwd(), ".env");
  const keys: string[] = [];

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          let value = trimmed.substring(eqIndex + 1).trim();
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          // Collect all GEMINI_API_KEY variants
          if (key.startsWith("GEMINI_API_KEY") && value && !value.includes("YOUR_")) {
            keys.push(value);
          }
        }
      }
    });
  }

  // Also check process.env for keys 1-6
  for (let i = 1; i <= 6; i++) {
    const keyName = i === 1 ? "GEMINI_API_KEY" : `GEMINI_API_KEY_${i}`;
    const keyValue = process.env[keyName];
    if (keyValue && !keys.includes(keyValue)) {
      keys.push(keyValue);
    }
  }

  return keys;
}

// Initialize the key pool
const GEMINI_KEYS = loadEnvKeys();

// Track key usage for round-robin distribution
let currentKeyIndex = 0;

// Track rate limit status per key
const keyStatus: Map<string, { lastUsed: number; errorCount: number }> = new Map();

// Initialize status for all keys
GEMINI_KEYS.forEach(key => {
  keyStatus.set(key, { lastUsed: 0, errorCount: 0 });
});

console.log(`[GeminiPool] Initialized with ${GEMINI_KEYS.length} API key(s)`);

/**
 * Agent types for dedicated key allocation
 */
export type AgentType = "reader" | "analyst" | "strategist" | "general";

/**
 * Get the next available Gemini API key using round-robin
 */
export function getNextGeminiKey(): string {
  if (GEMINI_KEYS.length === 0) {
    throw new Error("No Gemini API keys configured");
  }

  const key = GEMINI_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;

  // Update usage tracking
  const status = keyStatus.get(key);
  if (status) {
    status.lastUsed = Date.now();
  }

  return key;
}

/**
 * Get a dedicated key for a specific agent type
 * If multiple keys available, each agent type gets a preferred key
 */
export function getKeyForAgent(agent: AgentType): string {
  if (GEMINI_KEYS.length === 0) {
    throw new Error("No Gemini API keys configured");
  }

  // If only one key, use it for all agents
  if (GEMINI_KEYS.length === 1) {
    return GEMINI_KEYS[0];
  }

  // Distribute agents across available keys
  const agentKeyMap: Record<AgentType, number> = {
    reader: 0,
    analyst: Math.min(1, GEMINI_KEYS.length - 1),
    strategist: Math.min(2, GEMINI_KEYS.length - 1),
    general: 0,
  };

  const keyIndex = agentKeyMap[agent];
  const key = GEMINI_KEYS[keyIndex];

  console.log(`[GeminiPool] Agent "${agent}" using key ${keyIndex + 1}/${GEMINI_KEYS.length}`);

  return key;
}

/**
 * Report an error for a key (for future rate limit handling)
 */
export function reportKeyError(key: string): void {
  const status = keyStatus.get(key);
  if (status) {
    status.errorCount++;
    console.warn(`[GeminiPool] Key error count: ${status.errorCount}`);
  }
}

/**
 * Get pool status for debugging
 */
export function getPoolStatus(): { totalKeys: number; keyStats: Array<{ index: number; errorCount: number; lastUsed: Date | null }> } {
  return {
    totalKeys: GEMINI_KEYS.length,
    keyStats: GEMINI_KEYS.map((key, index) => {
      const status = keyStatus.get(key);
      return {
        index: index + 1,
        errorCount: status?.errorCount || 0,
        lastUsed: status?.lastUsed ? new Date(status.lastUsed) : null,
      };
    }),
  };
}

/**
 * Make a Gemini API call with automatic key rotation
 */
export async function callGemini(
  prompt: string,
  options: {
    agent?: AgentType;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
  } = {}
): Promise<string> {
  const {
    agent = "general",
    model = "gemini-2.0-flash",
    temperature = 0.7,
    maxOutputTokens = 1000,
  } = options;

  const apiKey = agent ? getKeyForAgent(agent) : getNextGeminiKey();

  try {
    // Use AbortController to enforce a 15-second timeout
    // This prevents the pipeline from hanging for 50+ seconds when the API is rate-limited
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature,
            maxOutputTokens,
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      reportKeyError(apiKey);
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text.trim();
    }

    if (data.error) {
      reportKeyError(apiKey);
      throw new Error(`Gemini error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    throw new Error("Unexpected Gemini response structure");
  } catch (error: any) {
    console.error(`[GeminiPool] API call failed:`, error.message);
    throw error;
  }
}

/**
 * Parse JSON from Gemini response (handles markdown code blocks)
 */
export function parseGeminiJSON<T>(text: string): T | null {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        console.error("[GeminiPool] Failed to parse JSON from code block");
      }
    }

    // Try to find JSON object or array in text
    const objectMatch = text.match(/\{[\s\S]*\}/);
    const arrayMatch = text.match(/\[[\s\S]*\]/);

    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // ignore
      }
    }

    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        // ignore
      }
    }

    console.error("[GeminiPool] Could not extract JSON from response");
    return null;
  }
}
