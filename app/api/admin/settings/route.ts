import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApiAdminContext } from "@/lib/admin/auth";
import { updateFeatureFlag, updatePlatformSettings } from "@/lib/admin/actions";
import { getFeatureFlags, getPlatformSettings } from "@/lib/admin/queries/settings";

export const runtime = "nodejs";

const bodySchema = z.object({
  reason: z.string().min(3),
  settings: z.record(z.unknown()).optional(),
  featureFlag: z
    .object({
      key: z.string().min(1),
      data: z.record(z.unknown()),
    })
    .optional(),
});

export async function GET() {
  try {
    await requireApiAdminContext("settings.read");
    const [settings, featureFlags] = await Promise.all([
      getPlatformSettings(),
      getFeatureFlags(),
    ]);
    return NextResponse.json({ settings, featureFlags });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load settings" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiAdminContext("settings.write");
    const body = bodySchema.parse(await request.json());
    const result: Record<string, unknown> = {};
    if (body.settings) {
      result.settings = await updatePlatformSettings(actor, body.settings, body.reason);
    }
    if (body.featureFlag) {
      result.featureFlag = await updateFeatureFlag(
        actor,
        body.featureFlag.key,
        body.featureFlag.data,
        body.reason
      );
    }
    revalidatePath("/admin/settings");
    revalidatePath("/admin");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 400 }
    );
  }
}
