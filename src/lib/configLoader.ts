// Loads versioned JSON config from /config and holds an in-memory overlay
// that the Admin portal can mutate at runtime (uploads, toggles, prompt edits).
//
// Config is imported statically so it is reliably bundled into serverless
// functions on Vercel. Editing a JSON file + redeploying updates behavior with
// no code change. Runtime admin edits use the in-memory overlay below.
//
// NOTE: The overlay is process-memory only and resets on restart. In production
// back it with Postgres/Redis (see README). All reads go through here so that
// swapping the storage layer requires no changes elsewhere.

import type { UseCase } from "./types";

import configJson from "../../config/config.json";
import questionnaireJson from "../../config/questionnaire.json";
import rulesJson from "../../config/rules.json";
import industryMappingJson from "../../config/industry_mapping.json";
import promptTemplatesJson from "../../config/prompt_templates.json";
import masterUseCasesJson from "../../config/master_usecases.json";

// ---- base config (immutable source of truth from disk, bundled at build) ----
const base = {
  config: configJson as any,
  questionnaire: questionnaireJson as any,
  rules: rulesJson as any,
  industryMapping: industryMappingJson as any,
  promptTemplates: promptTemplatesJson as any,
  masterUseCases: masterUseCasesJson as unknown as { useCases: UseCase[] },
};

// ---- runtime overlay (admin-managed) ----
interface Overlay {
  useCases: UseCase[] | null;
  promptTemplates: any | null;
  config: any | null;
}

// Persist overlay across hot-reloads / route invocations in a single process.
const g = globalThis as any;
if (!g.__meridianOverlay) {
  g.__meridianOverlay = { useCases: null, promptTemplates: null, config: null } as Overlay;
}
const overlay: Overlay = g.__meridianOverlay;

export const configStore = {
  getConfig: () => overlay.config ?? base.config,
  getQuestionnaire: () => base.questionnaire,
  getRules: () => base.rules,
  getIndustryMapping: () => base.industryMapping,
  getPromptTemplates: () => overlay.promptTemplates ?? base.promptTemplates,
  getUseCases: (): UseCase[] => overlay.useCases ?? base.masterUseCases.useCases,

  // ---- admin mutations ----
  setUseCases: (list: UseCase[]) => { overlay.useCases = list; },
  upsertUseCases: (incoming: UseCase[]) => {
    const current = [...configStore.getUseCases()];
    const byId = new Map(current.map((u) => [u.id, u]));
    for (const u of incoming) byId.set(u.id, { ...byId.get(u.id), ...u });
    overlay.useCases = Array.from(byId.values());
    return overlay.useCases;
  },
  toggleUseCase: (id: number, enabled: boolean) => {
    const list = configStore.getUseCases().map((u) =>
      u.id === id ? { ...u, enabled } : u
    );
    overlay.useCases = list;
    return list.find((u) => u.id === id);
  },
  setPromptTemplates: (tpl: any) => { overlay.promptTemplates = tpl; },
  setConfig: (cfg: any) => { overlay.config = cfg; },

  // export the full effective configuration (for download / version control)
  exportAll: () => ({
    config: configStore.getConfig(),
    questionnaire: base.questionnaire,
    rules: base.rules,
    industry_mapping: base.industryMapping,
    prompt_templates: configStore.getPromptTemplates(),
    master_usecases: { useCases: configStore.getUseCases() },
  }),
  reset: () => { overlay.useCases = null; overlay.promptTemplates = null; overlay.config = null; },
};
