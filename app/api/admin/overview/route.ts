import { NextResponse } from "next/server";
import { requireApiAdminContext } from "@/lib/admin/auth";
import { getOverviewMetrics } from "@/lib/admin/queries/overview";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireApiAdminContext("dashboard.read");
    const data = await getOverviewMetrics();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load overview" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }
    );
  }
}
