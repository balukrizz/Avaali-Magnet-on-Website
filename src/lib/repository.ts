// Use Case Repository — the single source of truth for recommendations.
// Independently replaceable: swap the config-backed implementation for a
// Postgres or vector-DB (Qdrant/Chroma) implementation without touching the
// rule engine or LLM service, as long as this interface is preserved.

import { configStore } from "./configLoader";
import type { UseCase } from "./types";

export const repository = {
  all(): UseCase[] {
    return configStore.getUseCases();
  },
  enabled(): UseCase[] {
    return configStore.getUseCases().filter((u) => u.enabled);
  },
  byId(id: number): UseCase | undefined {
    return configStore.getUseCases().find((u) => u.id === id);
  },
  byFunction(fn: string): UseCase[] {
    return this.enabled().filter((u) => u.function === fn);
  },
  functions(): string[] {
    return Array.from(new Set(this.all().map((u) => u.function)));
  },
  count(): number {
    return this.all().length;
  },
};
