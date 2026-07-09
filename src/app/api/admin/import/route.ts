// POST /admin/import -> import use cases from JSON or CSV (Excel: save-as CSV).
// Body: { format: "json" | "csv", data: string }
// CSV columns (header row, order-independent):
//   Industry, Business Function, Use Case, Pain Point, AI Objective,
//   Priority, ROI, Complexity, Timeline, Recommended Product, Tags
import { NextResponse } from "next/server";
import Papa from "papaparse";
import { configStore } from "@/lib/configLoader";
import type { UseCase } from "@/lib/types";

const splitList = (s: string) =>
  (s ?? "").split(/[;|]/).map((x) => x.trim()).filter(Boolean);

function rowToUseCase(row: Record<string, string>, index: number): UseCase {
  const get = (k: string) =>
    row[k] ?? row[k.toLowerCase()] ?? row[k.replace(/ /g, "")] ?? "";
  return {
    id: Number(get("id")) || 10000 + index,
    name: get("Use Case") || get("Use Case Name") || get("name"),
    function: get("Business Function") || get("function"),
    industry: splitList(get("Industry")).length ? splitList(get("Industry")) : ["All"],
    painPoints: splitList(get("Pain Point")),
    aiObjective: splitList(get("AI Objective")),
    difficulty: (get("Complexity") as any) || "Medium",
    implementationMonths: Number(get("Timeline")) || 4,
    roi: (get("ROI") as any) || "Medium",
    priority: (get("Priority") as any) || "Medium",
    recommendedSolutions: splitList(get("Recommended Product")),
    tags: splitList(get("Tags")),
    enabled: true,
  };
}

export async function POST(req: Request) {
  try {
    const { format, data } = await req.json();
    let incoming: UseCase[] = [];

    if (format === "json") {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const arr = Array.isArray(parsed) ? parsed : parsed.useCases;
      incoming = arr;
    } else if (format === "csv") {
      const parsed = Papa.parse(data, { header: true, skipEmptyLines: true });
      const rows = (parsed.data ?? []) as Record<string, string>[];
      incoming = rows.map(rowToUseCase);
    } else {
      return NextResponse.json({ error: "format must be 'json' or 'csv'" }, { status: 400 });
    }

    const merged = configStore.upsertUseCases(incoming);
    return NextResponse.json({ ok: true, imported: incoming.length, total: merged.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
