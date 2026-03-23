import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { soundboards } from "@/db/schema";
import { soundboardDataSchema } from "@/db/types";
import { z } from "zod";
import { desc } from "drizzle-orm";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  data: soundboardDataSchema,
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const id = nanoid(8);
  const now = new Date();

  await db.insert(soundboards).values({
    id,
    name: parsed.data.name,
    data: parsed.data.data,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id, name: parsed.data.name }, { status: 201 });
}

export async function GET() {
  const rows = await db
    .select({
      id: soundboards.id,
      name: soundboards.name,
      createdAt: soundboards.createdAt,
    })
    .from(soundboards)
    .orderBy(desc(soundboards.createdAt))
    .limit(50);

  return NextResponse.json(rows);
}
