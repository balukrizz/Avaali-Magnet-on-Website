// Rule Engine — scores every enabled use case against the questionnaire answers
// using weights from config/rules.json, then filters by the configured threshold.
// The LLM never searches; it only sees what this engine passes through.

import { configStore } from "./configLoader";
import { repository } from "./repository";
import type { Answers, ScoredUseCase, UseCase } from "./types";

function normalizeIndustry(industry: string | undefined): string | undefined {
  if (!industry) return undefined;
  const map = configStore.getIndustryMapping().aliases || {};
  return map[industry] || industry;
}

// Map questionnaire function labels onto repository function names.
function expandFunctions(functions: string[]): Set<string> {
  const aliases = configStore.getRules().functionAliases || {};
  const set = new Set<string>();
  for (const f of functions) {
    set.add(f);
    (aliases[f] || []).forEach((a: string) => set.add(a));
  }
  return set;
}

function overlaps(a: string[], b: string[]): number {
  const bs = new Set(b);
  return a.filter((x) => bs.has(x)).length;
}

export function scoreUseCase(uc: UseCase, answers: Answers): ScoredUseCase {
  const rules = configStore.getRules();
  const w = rules.weights;
  const partial = rules.partialCredit || {};

  const industry = normalizeIndustry(answers.industry);
  const fnSet = expandFunctions(answers.functions || []);

  // Industry: full credit if the use case targets this industry or "All".
  const industryMatch =
    !industry || uc.industry.includes("All") || uc.industry.includes(industry)
      ? w.industryMatch
      : 0;

  // Function: full credit if the use case's function is among selected (expanded).
  const functionMatch = fnSet.has(uc.function) ? w.functionMatch : 0;

  // Pain points: full if all requested overlap, partial credit otherwise.
  const painHits = overlaps(answers.painPoints || [], uc.painPoints);
  const painPointMatch =
    painHits === 0
      ? 0
      : painHits >= (answers.painPoints?.length || 1)
      ? w.painPointMatch
      : w.painPointMatch * (partial.painPointMatch ?? 0.5);

  // Objectives: same partial-credit logic.
  const objHits = overlaps(answers.objectives || [], uc.aiObjective);
  const objectiveMatch =
    objHits === 0
      ? 0
      : objHits >= (answers.objectives?.length || 1)
      ? w.objectiveMatch
      : w.objectiveMatch * (partial.objectiveMatch ?? 0.5);

  const score = Math.round(
    industryMatch + functionMatch + painPointMatch + objectiveMatch
  );

  return {
    ...uc,
    score,
    breakdown: { industryMatch, functionMatch, painPointMatch, objectiveMatch },
  };
}

export interface FilterResult {
  candidates: ScoredUseCase[];   // passed threshold, sorted desc, capped
  evaluated: number;             // total enabled use cases scored
  passed: number;                // count above threshold
  threshold: number;
}

export function filterUseCases(answers: Answers): FilterResult {
  const rules = configStore.getRules();
  const threshold = rules.threshold ?? 70;
  const cap = rules.maxUseCasesToLLM ?? 12;

  const enabled = repository.enabled();
  const scored = enabled
    .map((uc) => scoreUseCase(uc, answers))
    .sort((a, b) => b.score - a.score);

  const passing = scored.filter((u) => u.score > threshold);

  return {
    candidates: passing.slice(0, cap),
    evaluated: enabled.length,
    passed: passing.length,
    threshold,
  };
}
