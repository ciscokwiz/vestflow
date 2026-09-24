import { NextRequest, NextResponse } from "next/server";
import { queryStreamCycles } from "@/indexer/src/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const account = request.nextUrl.searchParams.get("account") ?? undefined;
    const token = request.nextUrl.searchParams.get("token") ?? undefined;
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const cycles = queryStreamCycles({ account, token, limit });
    return NextResponse.json({ cycles }, {
      headers: { "Cache-Control": "public, max-age=10" },
    });
  } catch (error) {
    console.error("Error in GET /analytics/cycles:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
