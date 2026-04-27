import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdminContext } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/audit";
import {
  CHAT_HISTORY_MAX_ENTRIES,
  pullUserChatHistory,
} from "@/lib/admin/queries/chat-history";

export const runtime = "nodejs";

const bodySchema = z.object({
  reason: z.string().min(3).max(500),
  limit: z.number().int().min(1).max(CHAT_HISTORY_MAX_ENTRIES).optional(),
  sinceDays: z.number().int().min(1).max(365).optional(),
});

function statusForError(error: unknown): number {
  if (!(error instanceof Error)) return 500;
  if (error.message === "UNAUTHORIZED") return 401;
  if (error.message === "FORBIDDEN") return 403;
  if (error.name === "ZodError") return 400;
  // Firestore failed-precondition is almost always a missing index.
  const code = (error as { code?: unknown }).code;
  if (code === 9 || code === "9" || code === "failed-precondition") return 412;
  return 500;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const resolvedParams = await params;
  let actor;
  try {
    actor = await requireApiAdminContext("users.read");
    const body = bodySchema.parse(await request.json());

    const since = body.sinceDays
      ? Date.now() - body.sinceDays * 24 * 60 * 60 * 1000
      : undefined;

    const result = await pullUserChatHistory(resolvedParams.uid, {
      limit: body.limit,
      since,
    });

    await writeAuditLog(actor, {
      action: "user.pull_chat_history",
      targetType: "user",
      targetId: resolvedParams.uid,
      reason: body.reason,
      status: "success",
      metadata: {
        entryCount: result.entryCount,
        truncated: result.truncated,
        limit: body.limit ?? CHAT_HISTORY_MAX_ENTRIES,
        sinceDays: body.sinceDays ?? null,
        totalTokens: result.totalTokens,
        totalInputTokens: result.totalInputTokens,
        totalOutputTokens: result.totalOutputTokens,
        totalCostUsd: result.totalCostUsd,
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const status = statusForError(error);
    const message =
      error instanceof Error ? error.message : "Failed to pull chat history";
    console.error("[admin.chatHistory.route] pull failed", {
      uid: resolvedParams.uid,
      status,
      message,
      code: (error as { code?: unknown })?.code ?? null,
    });
    if (actor) {
      await writeAuditLog(actor, {
        action: "user.pull_chat_history",
        targetType: "user",
        targetId: resolvedParams.uid,
        status: "failed",
        reason: message,
      }).catch(() => {});
    }
    return NextResponse.json({ error: message }, { status });
  }
}
