import { NextResponse } from "next/server";
import { db } from "@/db";
import { soundboards } from "@/db/schema";
import { soundboardDataSchema } from "@/db/types";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const rows = await db
      .select()
      .from(soundboards)
      .where(eq(soundboards.id, id))
      .limit(1);

    if (!rows[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("GET /api/soundboards/[id] failed:", error);
    return NextResponse.json({ error: "Failed to load soundboard" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await db
      .delete(soundboards)
      .where(eq(soundboards.id, id))
      .returning({ id: soundboards.id });

    if (result.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/soundboards/[id] failed:", error);
    return NextResponse.json({ error: "Failed to delete soundboard" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = soundboardDataSchema.safeParse(body?.data);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await db
      .update(soundboards)
      .set({
        data: parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(soundboards.id, id))
      .returning({ id: soundboards.id });

    if (result.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/soundboards/[id] failed:", error);
    return NextResponse.json({ error: "Failed to update soundboard" }, { status: 500 });
  }
}
