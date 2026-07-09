// GET   /admin/config -> effective configuration + repository stats
// POST  /admin/config -> admin mutations: toggle use case, edit prompt, export, reset
import { NextResponse } from "next/server";
import { configStore } from "@/lib/configLoader";
import { repository } from "@/lib/repository";

export async function GET() {
  return NextResponse.json({
    config: configStore.getConfig(),
    rules: configStore.getRules(),
    promptTemplates: configStore.getPromptTemplates(),
    stats: {
      totalUseCases: repository.count(),
      enabled: repository.enabled().length,
      functions: repository.functions(),
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  switch (body.action) {
    case "toggleUseCase": {
      const uc = configStore.toggleUseCase(Number(body.id), Boolean(body.enabled));
      return NextResponse.json({ ok: true, useCase: uc });
    }
    case "setPrompt": {
      configStore.setPromptTemplates(body.promptTemplates);
      return NextResponse.json({ ok: true });
    }
    case "setProvider": {
      const cfg = JSON.parse(JSON.stringify(configStore.getConfig()));
      cfg.llm.provider = body.provider;
      if (typeof body.enabled === "boolean") cfg.llm.enabled = body.enabled;
      configStore.setConfig(cfg);
      return NextResponse.json({ ok: true, llm: cfg.llm });
    }
    case "export":
      return NextResponse.json(configStore.exportAll());
    case "reset":
      configStore.reset();
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
