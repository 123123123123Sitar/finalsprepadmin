import { NextResponse } from "next/server";
import { requireApiAdminContext } from "@/lib/admin/auth";
import { listAuditLogs } from "@/lib/admin/queries/audit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireApiAdminContext("audit.read");
    const { searchParams } = new URL(request.url);
    const logs = await listAuditLogs({
      targetId: searchParams.get("targetId") || undefined,
      actorUid: searchParams.get("actorUid") || undefined,
      action: searchParams.get("action") || undefined,
      limit: Number(searchParams.get("limit") || 100),
    });
    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load audit logs" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }
    );
  }
}
