// LLM Service — assembles the prompt from templates + filtered candidates,
// calls the provider, parses JSON, and ENFORCES the "never invent" guarantee by
// discarding any returned opportunity that is not in the candidate set.

import { configStore } from "../configLoader";
import { chat } from "./provider";
import type { Answers, ScoredUseCase, Report } from "../types";

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function candidatesForPrompt(candidates: ScoredUseCase[]) {
  return candidates.map((c) => ({
    id: c.id,
    name: c.name,
    function: c.function,
    industry: c.industry,
    painPoints: c.painPoints,
    aiObjective: c.aiObjective,
    roi: c.roi,
    difficulty: c.difficulty,
    implementationMonths: c.implementationMonths,
    recommendedSolutions: c.recommendedSolutions,
    ruleScore: c.score,
  }));
}

function extractJSON(text: string): any {
  // Strip markdown fences if a model added them despite instructions.
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in LLM output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function generateReport(
  answers: Answers,
  candidates: ScoredUseCase[]
): Promise<Partial<Report> & { _provider: string }> {
  const tpl = configStore.getPromptTemplates();
  const rules = configStore.getRules();
  const topN = rules.topOpportunities ?? 5;

  const user = fill(tpl.user, {
    profile: JSON.stringify({
      company: answers.company,
      designation: answers.designation,
      industry: answers.industry,
      orgSize: answers.orgSize,
    }, null, 2),
    answers: JSON.stringify({
      functions: answers.functions,
      painPoints: answers.painPoints,
      objectives: answers.objectives,
    }, null, 2),
    topN: String(topN),
    candidates: JSON.stringify(candidatesForPrompt(candidates), null, 2),
    schema: JSON.stringify(tpl.schema, null, 2),
  });

  const { text, provider } = await chat({ system: tpl.system, user });
  const parsed = extractJSON(text);

  // ---- GUARDRAIL: drop anything not in the candidate repository ----
  const validIds = new Set(candidates.map((c) => c.id));
  const validNames = new Set(candidates.map((c) => c.name.toLowerCase()));
  const opportunities = (parsed.topOpportunities || []).filter(
    (o: any) => validIds.has(Number(o.id)) || validNames.has(String(o.name).toLowerCase())
  );

  return { ...parsed, topOpportunities: opportunities, _provider: provider };
}
