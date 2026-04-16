import { NextResponse } from "next/server";
import { requireApiAdminContext } from "@/lib/admin/auth";
import { getBillingRiskItems, getBillingSnapshots } from "@/lib/admin/queries/billing";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireApiAdminContext("billing.read");
    const [risk, snapshots] = await Promise.all([
      getBillingRiskItems(),
      getBillingSnapshots(30),
    ]);
    return NextResponse.json({ risk, snapshots });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load billing" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }
    );
  }
}
