// GET  /api/questions  -> returns the config-driven questionnaire
// POST /api/questions  -> validates a submitted answer set against the questionnaire
import { NextResponse } from "next/server";
import { configStore } from "@/lib/configLoader";

export async function GET() {
  return NextResponse.json(configStore.getQuestionnaire());
}

export async function POST(req: Request) {
  const body = await req.json();
  const q = configStore.getQuestionnaire();
  const errors: string[] = [];
  for (const step of q.steps) {
    for (const f of step.fields) {
      const v = body[f.mapsTo] ?? body[f.id];
      if (f.required && (v == null || (Array.isArray(v) && v.length === 0) || v === "")) {
        errors.push(`${f.label} is required.`);
      }
      if (f.maxSelections && Array.isArray(v) && v.length > f.maxSelections) {
        errors.push(`${f.label}: choose at most ${f.maxSelections}.`);
      }
    }
  }
  return NextResponse.json({ valid: errors.length === 0, errors });
}
