import { db } from "@/db";
import { soundboards } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BoardLoader } from "./board-loader";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rows = await db
    .select()
    .from(soundboards)
    .where(eq(soundboards.id, id))
    .limit(1);

  if (!rows[0]) notFound();

  return <BoardLoader soundboard={{ id: rows[0].id, name: rows[0].name, data: rows[0].data }} />;
}
