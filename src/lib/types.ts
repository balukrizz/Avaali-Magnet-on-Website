// Shared domain types for the platform.

export interface UseCase {
  id: number;
  name: string;
  function: string;
  industry: string[];
  painPoints: string[];
  aiObjective: string[];
  difficulty: "Low" | "Medium" | "High";
  implementationMonths: number;
  roi: "Low" | "Medium" | "High";
  priority: "Low" | "Medium" | "High";
  recommendedSolutions: string[];
  tags: string[];
  enabled: boolean;
}

export interface Answers {
  company: string;
  designation: string;
  industry?: string;
  orgSize?: string;
  functions: string[];   // business functions from questionnaire
  painPoints: string[];  // operational challenge(s)
  objectives: string[];  // primary objective(s)
}

export interface ScoredUseCase extends UseCase {
  score: number;
  breakdown: {
    industryMatch: number;
    functionMatch: number;
    painPointMatch: number;
    objectiveMatch: number;
  };
}

export interface Opportunity {
  id: number;
  name: string;
  why: string;
  estimatedROI: "Low" | "Medium" | "High";
  automationPotential: string;
  complexity: "Low" | "Medium" | "High";
  timelineMonths: number;
  recommendedSolutions: string[];
}

export interface Report {
  company: string;
  designation: string;
  industry?: string;
  overallReadinessScore: number;
  maturity: "Foundational" | "Developing" | "High" | "Advanced";
  confidenceScore: number;
  executiveSummary: string;
  topOpportunities: Opportunity[];
  businessOutcomes: string[];
  roadmap: { quickWins: string[]; mediumTerm: string[]; strategic: string[] };
  technologyRecommendations: string[];
  riskAssessment: string[];
  expectedKPIs: string[];
  meta: {
    candidatesEvaluated: number;
    candidatesPassed: number;
    source: "llm" | "deterministic";
    provider?: string;
  };
}
