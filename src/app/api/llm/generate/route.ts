// POST /llm/generate -> low-level: filter + call the LLM directly (advanced/debug use)
import { NextResponse } from "next/server";
import { filterUseCases } from "@/lib/ruleEngine";
import { generateReport } from "@/lib/llm/service";
import type { Answers } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const answers = (await req.json()) as Answers;
    const { candidates } = filterUseCases(answers);
    const out = await generateReport(answers, candidates);
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
