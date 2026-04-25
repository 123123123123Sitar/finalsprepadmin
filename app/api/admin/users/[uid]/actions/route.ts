import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiAdminContext } from "@/lib/admin/auth";
import { runAdminMutation } from "@/lib/admin/actions";
import { writeAuditLog, requestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const resolvedParams = await params;
  let actor;
  try {
    actor = await requireApiAdminContext("users.write");
    const body = await request.json();
    const result = await runAdminMutation(actor, {
      ...body,
      uid: resolvedParams.uid,
    });
    revalidatePath(`/admin/users/${resolvedParams.uid}`);
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (actor) {
      const meta = requestMetadata(request);
      await writeAuditLog(actor, {
        action: "mutation.failed",
        targetType: "user",
        targetId: resolvedParams.uid,
        status: "failed",
        reason: error instanceof Error ? error.message : "Unknown mutation error",
        metadata: meta,
      }).catch(() => {
        /* never let audit failure mask the original error */
      });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mutation failed" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 400 }
    );
  }
}
