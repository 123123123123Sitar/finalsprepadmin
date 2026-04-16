import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdminContext } from "@/lib/admin/auth";
import { getContentHealth } from "@/lib/admin/queries/content";
import { refreshContentHealth, updateContentSettings } from "@/lib/admin/actions";

export const runtime = "nodejs";

const bodySchema = z.object({
  reason: z.string().min(3),
  refresh: z.boolean().optional(),
  contentSettings: z.record(z.unknown()).optional(),
});

export async function GET() {
  try {
    await requireApiAdminContext("content.read");
    const records = await getContentHealth();
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load content health" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiAdminContext("content.write");
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const result: Record<string, unknown> = {};
    if (body.contentSettings) {
      result.contentSettings = await updateContentSettings(
        actor,
        body.contentSettings,
        body.reason
      );
    }
    if (body.refresh !== false) {
      result.records = await refreshContentHealth(actor, body.reason);
    }
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to refresh content health" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 400 }
    );
  }
}
