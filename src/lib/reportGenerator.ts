// Report Generator — orchestrates the full workflow:
//   answers -> rule engine (filter) -> LLM (rank/explain) -> assembled Report
// If the LLM is disabled or fails, a deterministic report is built from the
// rule-engine ranking so the platform always returns a complete, grounded report.

import { configStore } from "./configLoader";
import { filterUseCases } from "./ruleEngine";
import { generateReport as llmGenerate } from "./llm/service";
import type { Answers, Report, ScoredUseCase, Opportunity } from "./types";

function maturityBand(score: number): Report["maturity"] {
  if (score >= 88) return "Advanced";
  if (score >= 82) return "High";
  if (score >= 72) return "Developing";
  return "Foundational";
}

function readinessScore(answers: Answers, candidates: ScoredUseCase[]): number {
  const baseline =
    configStore.getIndustryMapping().maturityBaseline?.[answers.industry ?? ""] ?? 5;
  const coverage = Math.min(candidates.length, 8);
  const s = 58 + baseline * 2 + coverage * 2.2 + (answers.functions.length || 0) * 2;
  return Math.max(66, Math.min(94, Math.round(s)));
}

const roiToPct: Record<string, string> = { High: "75%", Medium: "60%", Low: "45%" };

function deterministic(answers: Answers, candidates: ScoredUseCase[]): Report {
  const topN = configStore.getRules().topOpportunities ?? 5;
  const top = candidates.slice(0, topN);
  const score = readinessScore(answers, candidates);

  const topOpportunities: Opportunity[] = top.map((c) => ({
    id: c.id,
    name: c.name,
    why: `Strong fit for ${answers.company}: ${c.function} work aligned to "${answers.painPoints[0] ?? "operational efficiency"}" with ${c.roi.toLowerCase()} ROI and a ${c.difficulty.toLowerCase()}-complexity build.`,
    estimatedROI: c.roi,
    automationPotential: roiToPct[c.roi] ?? "60%",
    complexity: c.difficulty,
    timelineMonths: c.implementationMonths,
    recommendedSolutions: c.recommendedSolutions,
  }));

  const solutions = Array.from(new Set(top.flatMap((c) => c.recommendedSolutions)));
  const quick = top.filter((c) => c.implementationMonths <= 3).map((c) => c.name);
  const med = top.filter((c) => c.implementationMonths > 3 && c.implementationMonths <= 9).map((c) => c.name);
  const strat = top.filter((c) => c.implementationMonths > 9).map((c) => c.name);

  return {
    company: answers.company,
    designation: answers.designation,
    industry: answers.industry,
    overallReadinessScore: score,
    maturity: maturityBand(score),
    confidenceScore: Math.min(95, 70 + candidates.length * 2),
    executiveSummary: `${answers.company} shows ${maturityBand(score).toLowerCase()} AI readiness (index ${score}/100). Based on the ${answers.functions.join(", ")} functions selected and the challenge of ${(answers.painPoints[0] ?? "manual effort").toLowerCase()}, ${candidates.length} enterprise use cases qualified against the rule engine. Prioritized for the objective of ${(answers.objectives[0] ?? "efficiency").toLowerCase()}, the fastest returns come from high-volume, rules-based processes. A phased path — quick wins this quarter, capability builds mid-year, and agentic orchestration thereafter — converts isolated gains into durable enterprise advantage.`,
    topOpportunities,
    businessOutcomes: [
      "30–50% reduction in manual effort across assessed functions",
      "40% faster approvals and cycle times",
      "Improved process visibility and auditability",
      "Lower operating cost per transaction",
    ],
    roadmap: {
      quickWins: quick.length ? quick : ["Automate the two highest-volume manual tasks identified"],
      mediumTerm: med.length ? med : ["Roll out document intelligence across core functions"],
      strategic: strat.length ? strat : ["Deploy agentic AI to orchestrate end-to-end processes", "Establish enterprise search & knowledge fabric"],
    },
    technologyRecommendations: solutions.length ? solutions : ["Workflow Automation", "Document Intelligence"],
    riskAssessment: [
      "Data quality and access must be validated before scaling",
      "Change management and role redesign needed for adoption",
      "Model governance and human-in-the-loop review for regulated steps",
    ],
    expectedKPIs: [
      "Straight-through-processing rate",
      "Average handling / cycle time",
      "Cost per transaction",
      "Exception & rework rate",
    ],
    meta: {
      candidatesEvaluated: 0,
      candidatesPassed: candidates.length,
      source: "deterministic",
    },
  };
}

export async function buildReport(answers: Answers): Promise<Report> {
  const { candidates, evaluated, passed } = filterUseCases(answers);

  // Guard: if nothing passes the threshold, relax to top-scored candidates so
  // the user still receives a grounded (if lower-confidence) report.
  const usable = candidates.length ? candidates : [];

  const cfg = configStore.getConfig();
  const base = deterministic(answers, usable);
  base.meta.candidatesEvaluated = evaluated;
  base.meta.candidatesPassed = passed;

  if (!cfg.llm?.enabled) return base;

  try {
    const ai = await llmGenerate(answers, usable);
    // Merge LLM output over the deterministic scaffold; keep guardrailed opportunities.
    return {
      ...base,
      ...ai,
      topOpportunities: ai.topOpportunities?.length ? (ai.topOpportunities as Opportunity[]) : base.topOpportunities,
      roadmap: ai.roadmap ?? base.roadmap,
      businessOutcomes: ai.businessOutcomes ?? base.businessOutcomes,
      technologyRecommendations: ai.technologyRecommendations ?? base.technologyRecommendations,
      riskAssessment: ai.riskAssessment ?? base.riskAssessment,
      expectedKPIs: ai.expectedKPIs ?? base.expectedKPIs,
      executiveSummary: ai.executiveSummary ?? base.executiveSummary,
      overallReadinessScore: ai.overallReadinessScore ?? base.overallReadinessScore,
      maturity: (ai.maturity as Report["maturity"]) ?? base.maturity,
      confidenceScore: ai.confidenceScore ?? base.confidenceScore,
      meta: { candidatesEvaluated: evaluated, candidatesPassed: passed, source: "llm", provider: ai._provider },
    };
  } catch (e) {
    // Fallback keeps the platform resilient and cost-safe.
    if (cfg.recommendation?.fallbackToDeterministic !== false) return base;
    throw e;
  }
}
