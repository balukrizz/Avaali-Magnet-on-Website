// POST /api/recommend -> runs the rule engine only (no LLM). Returns scored candidates.
import { NextResponse } from "next/server";
import { filterUseCases } from "@/lib/ruleEngine";
import type { Answers } from "@/lib/types";

export async function POST(req: Request) {
  const answers = (await req.json()) as Answers;
  const result = filterUseCases(answers);
  return NextResponse.json(result);
}
