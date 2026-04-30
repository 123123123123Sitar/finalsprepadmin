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
      `Daily tokens: ${detail.dailyTokens.remaining} / ${detail.dailyTokens.cap} remaining (${detail.dailyTokens.used} used)`,
      `Bonus tokens: ${detail.tokenBank.balance}`,
      `AI usage (30d): ${detail.aiUsage.totalRequests} requests, ${detail.aiUsage.totalTokens} tokens`,
      `Flags: ${Object.entries(detail.overlay.flags || {})
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key)
        .join(", ") || "none"}`,
      `Recent note: ${detail.notes[0]?.body || "none"}`,
    ].join("\n");
    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build support summary";
    const status =
      message === "FORBIDDEN" ? 403 : message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
