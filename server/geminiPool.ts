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

  // Also check process.env for all GEMINI_API_KEY variants (up to 20)
  // Check both GEMINI_API_KEY and GEMINI_API_KEY_1 for the first key
  const baseKey = process.env["GEMINI_API_KEY"];
  if (baseKey && !keys.includes(baseKey)) {
    keys.push(baseKey);
  }
  for (let i = 1; i <= 20; i++) {
    const keyValue = process.env[`GEMINI_API_KEY_${i}`];
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

// Per-agent round-robin counters so each agent type rotates independently
const agentKeyCounters: Map<string, number> = new Map();

// Track rate limit status per key
const keyStatus: Map<string, { lastUsed: number; errorCount: number; rateLimitedUntil: number }> = new Map();

// Initialize status for all keys
GEMINI_KEYS.forEach(key => {
  keyStatus.set(key, { lastUsed: 0, errorCount: 0, rateLimitedUntil: 0 });
});

console.log(`[GeminiPool] Initialized with ${GEMINI_KEYS.length} API key(s)`);

/**
 * Agent types for dedicated key allocation
 */
export type AgentType = "reader" | "analyst" | "strategist" | "general";

/**
 * Get the next available Gemini API key using round-robin,
 * skipping keys that are currently rate-limited.
 */
export function getNextGeminiKey(): string {
  if (GEMINI_KEYS.length === 0) {
    throw new Error("No Gemini API keys configured");
  }

  const now = Date.now();

  // Try to find a non-rate-limited key starting from currentKeyIndex
  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const idx = (currentKeyIndex + attempt) % GEMINI_KEYS.length;
    const key = GEMINI_KEYS[idx];
    const status = keyStatus.get(key);

    if (!status || status.rateLimitedUntil <= now) {
      currentKeyIndex = (idx + 1) % GEMINI_KEYS.length;
      if (status) {
        status.lastUsed = now;
      }
      return key;
    }
  }

  // All keys are rate-limited — return the one whose cooldown expires soonest
  let bestIdx = currentKeyIndex;
  let bestExpiry = Infinity;
  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const status = keyStatus.get(GEMINI_KEYS[i]);
    if (status && status.rateLimitedUntil < bestExpiry) {
      bestExpiry = status.rateLimitedUntil;
      bestIdx = i;
    }
  }

  currentKeyIndex = (bestIdx + 1) % GEMINI_KEYS.length;
  console.warn(`[GeminiPool] All keys rate-limited, using key ${bestIdx + 1} (cooldown expires soonest)`);
  return GEMINI_KEYS[bestIdx];
}

/**
 * Get a key for a specific agent type using round-robin rotation.
 * Each agent type maintains its own rotation counter across the full pool.
 */
export function getKeyForAgent(agent: AgentType): string {
  if (GEMINI_KEYS.length === 0) {
    throw new Error("No Gemini API keys configured");
  }

  const now = Date.now();
  const counter = agentKeyCounters.get(agent) || 0;

  // Find the next non-rate-limited key starting from this agent's counter
  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const idx = (counter + attempt) % GEMINI_KEYS.length;
    const key = GEMINI_KEYS[idx];
    const status = keyStatus.get(key);

    if (!status || status.rateLimitedUntil <= now) {
      agentKeyCounters.set(agent, (idx + 1) % GEMINI_KEYS.length);
      if (status) {
        status.lastUsed = now;
      }
      console.log(`[GeminiPool] Agent "${agent}" using key ${idx + 1}/${GEMINI_KEYS.length}`);
      return key;
    }
  }

  // All rate-limited — rotate anyway
  const idx = counter % GEMINI_KEYS.length;
  agentKeyCounters.set(agent, (idx + 1) % GEMINI_KEYS.length);
  console.warn(`[GeminiPool] Agent "${agent}" all keys rate-limited, using key ${idx + 1}/${GEMINI_KEYS.length}`);
  return GEMINI_KEYS[idx];
}

/**
 * Report an error for a key. On 429 errors, mark the key as rate-limited
 * for 60 seconds so other keys are preferred.
 */
export function reportKeyError(key: string, statusCode?: number): void {
  const status = keyStatus.get(key);
  if (status) {
    status.errorCount++;
    if (statusCode === 429) {
      // Cool off this key for 60 seconds
      status.rateLimitedUntil = Date.now() + 60_000;
      console.warn(`[GeminiPool] Key rate-limited (429), cooling off for 60s. Total errors: ${status.errorCount}`);
    } else {
      console.warn(`[GeminiPool] Key error count: ${status.errorCount}`);
    }
  }
}

/**
 * Get pool status for debugging
 */
export function getPoolStatus(): { totalKeys: number; keyStats: Array<{ index: number; errorCount: number; lastUsed: Date | null; rateLimited: boolean }> } {
  const now = Date.now();
  return {
    totalKeys: GEMINI_KEYS.length,
    keyStats: GEMINI_KEYS.map((key, index) => {
      const status = keyStatus.get(key);
      return {
        index: index + 1,
        errorCount: status?.errorCount || 0,
        lastUsed: status?.lastUsed ? new Date(status.lastUsed) : null,
        rateLimited: status ? status.rateLimitedUntil > now : false,
      };
    }),
  };
}

/**
 * Make a single Gemini API call (no retry, used internally)
 */
async function callGeminiOnce(
  prompt: string,
  apiKey: string,
  model: string,
  temperature: number,
  maxOutputTokens: number
): Promise<string> {
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
    reportKeyError(apiKey, response.status);
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
}

/**
 * Make a Gemini API call with automatic key rotation and retry on failure.
 * On 429/rate-limit errors, marks the key as rate-limited and retries
 * with the next available key, up to the total number of keys in the pool.
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

  const maxRetries = Math.min(GEMINI_KEYS.length, 9);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = agent ? getKeyForAgent(agent) : getNextGeminiKey();

    try {
      return await callGeminiOnce(prompt, apiKey, model, temperature, maxOutputTokens);
    } catch (error: any) {
      lastError = error;
      const is429 = error.message?.includes("(429)");
      const isTimeout = error.name === "AbortError";
      const isRetryable = is429 || isTimeout;

      if (isRetryable && attempt < maxRetries - 1) {
        console.warn(`[GeminiPool] Attempt ${attempt + 1}/${maxRetries} failed (${is429 ? "429 rate limit" : "timeout"}), trying next key...`);
        continue;
      }

      console.error(`[GeminiPool] API call failed after ${attempt + 1} attempt(s):`, error.message);
      throw error;
    }
  }

  throw lastError || new Error("All Gemini API keys exhausted");
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
