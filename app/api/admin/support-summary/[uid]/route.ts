import { NextResponse } from "next/server";
import { requireApiAdminContext } from "@/lib/admin/auth";
import { getUserDetail } from "@/lib/admin/queries/users";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const resolvedParams = await params;
    await requireApiAdminContext("users.read");
    const detail = await getUserDetail(resolvedParams.uid);
    const summary = [
      `User: ${detail.auth.displayName || "Unknown"} <${detail.auth.email || "no-email"}>`,
      `UID: ${detail.auth.uid}`,
      `Plan: ${detail.billing.plan} (${detail.billing.status || "inactive"})`,
      `Token balance: ${detail.tokenBank.balance}`,
      `AI usage (30d): ${detail.aiUsage.totalRequests} requests, ${detail.aiUsage.totalTokens} tokens`,
      `Flags: ${Object.entries(detail.overlay.flags || {})
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key)
        .join(", ") || "none"}`,
      `Recent note: ${detail.notes[0]?.body || "none"}`,
    ].join("\n");
    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build support summary" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }
    );
  }
}
