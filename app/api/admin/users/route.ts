import { NextResponse } from "next/server";
import { requireApiAdminContext } from "@/lib/admin/auth";
import { listUsers } from "@/lib/admin/queries/users";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireApiAdminContext("users.read");
    const { searchParams } = new URL(request.url);
    const data = await listUsers({
      pageSize: Number(searchParams.get("pageSize") || 25),
      pageToken: searchParams.get("pageToken") || undefined,
      search: searchParams.get("search") || undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load users" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }
    );
  }
}
