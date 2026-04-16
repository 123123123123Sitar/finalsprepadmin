import { NextResponse } from "next/server";
import { requireApiAdminContext } from "@/lib/admin/auth";
import { getHeavyUsers, getUsageBreakdownByRoute, getUsageTimeseries } from "@/lib/admin/queries/usage";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireApiAdminContext("usage.read");
    const [timeseries, heavyUsers, byRoute] = await Promise.all([
      getUsageTimeseries(30),
      getHeavyUsers(25),
      getUsageBreakdownByRoute(30),
    ]);
    return NextResponse.json({ timeseries, heavyUsers, byRoute });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load usage" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }
    );
  }
}
