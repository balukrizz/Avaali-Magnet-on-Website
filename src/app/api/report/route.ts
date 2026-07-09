// POST /api/report -> full workflow: rule engine -> LLM -> assembled Report (with fallback)
import { NextResponse } from "next/server";
import { buildReport } from "@/lib/reportGenerator";
import type { Answers } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const answers = (await req.json()) as Answers;
    if (!answers?.company || !answers?.functions?.length) {
      return NextResponse.json({ error: "company and at least one function are required" }, { status: 400 });
    }
    const report = await buildReport(answers);
    return NextResponse.json(report);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "report generation failed" }, { status: 500 });
  }
}
