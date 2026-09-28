import { NextResponse, type NextRequest } from "next/server";
import { loadCorps } from "@/lib/dart/corpList";
import { searchCorps } from "@/lib/dart/corps";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const results = searchCorps(await loadCorps(), q, 10);
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "검색 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
