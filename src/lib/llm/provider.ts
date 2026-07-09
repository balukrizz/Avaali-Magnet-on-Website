// Provider abstraction layer. One interface, many backends. The active provider
// is chosen in config/config.json ("llm.provider"); API keys come from env.
// Adding a provider = add one case here + one entry in config.json. No other
// module needs to change.

import { configStore } from "../configLoader";

export interface ChatRequest {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

function providerConf() {
  const cfg = configStore.getConfig().llm;
  const name: string = cfg.provider;
  const p = cfg.providers[name];
  if (!p) throw new Error(`Unknown LLM provider: ${name}`);
  const apiKey = p.apiKeyEnv ? process.env[p.apiKeyEnv] : "";
  return { name, ...p, apiKey, temperature: cfg.temperature, maxTokens: cfg.maxTokens };
}

// OpenAI-compatible chat completions (OpenAI, Mistral, Groq, Ollama, Azure*).
async function openAICompatible(
  baseURL: string,
  model: string,
  apiKey: string,
  req: ChatRequest,
  headers: Record<string, string> = {},
  pathOverride?: string
): Promise<string> {
  const url = pathOverride ?? `${baseURL}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...headers },
    body: JSON.stringify({
      model,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

// Anthropic Messages API.
async function anthropic(baseURL: string, model: string, apiKey: string, req: ChatRequest): Promise<string> {
  const res = await fetch(`${baseURL}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
}

// Google Gemini generateContent.
async function gemini(baseURL: string, model: string, apiKey: string, req: ChatRequest): Promise<string> {
  const url = `${baseURL}/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      generationConfig: { temperature: req.temperature, maxOutputTokens: req.maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
}

// Ollama local chat.
async function ollama(baseURL: string, model: string, req: ChatRequest): Promise<string> {
  const res = await fetch(`${baseURL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: req.temperature },
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.message?.content ?? "";
}

export async function chat(req: ChatRequest): Promise<{ text: string; provider: string }> {
  const c = providerConf();
  const r: ChatRequest = {
    ...req,
    temperature: req.temperature ?? c.temperature,
    maxTokens: req.maxTokens ?? c.maxTokens,
  };

  let text = "";
  switch (c.name) {
    case "openai":
    case "mistral":
    case "groq":
      text = await openAICompatible(c.baseURL, c.model, c.apiKey, r);
      break;
    case "azure":
      text = await openAICompatible(
        c.baseURL, c.model, "", r,
        { "api-key": c.apiKey },
        `${c.baseURL}/openai/deployments/${c.model}/chat/completions?api-version=${c.apiVersion}`
      );
      break;
    case "claude":
      text = await anthropic(c.baseURL, c.model, c.apiKey, r);
      break;
    case "gemini":
      text = await gemini(c.baseURL, c.model, c.apiKey, r);
      break;
    case "ollama":
      text = await ollama(c.baseURL, c.model, r);
      break;
    default:
      throw new Error(`Unhandled provider: ${c.name}`);
  }
  return { text, provider: c.name };
}
