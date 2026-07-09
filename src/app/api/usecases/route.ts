// GET /api/usecases  -> master repository (optionally filtered by ?function= & ?enabled=)
import { NextResponse } from "next/server";
import { repository } from "@/lib/repository";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fn = searchParams.get("function");
  const enabledOnly = searchParams.get("enabled") === "true";
  let list = enabledOnly ? repository.enabled() : repository.all();
  if (fn) list = list.filter((u) => u.function === fn);
  return NextResponse.json({ count: list.length, useCases: list });
}
