import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notices, tasks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { noticeOut, taskOut, err } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id); if (!id) return err("Notice not found.", 404);
  const [n] = await db.select().from(notices).where(eq(notices.id, id));
  if (!n) return err("That notice no longer exists.", 404);
  const ts = await db.select().from(tasks).where(eq(tasks.noticeId, id)).orderBy(desc(tasks.createdAt));
  return NextResponse.json({ notice: noticeOut(n), tasks: ts.map(taskOut) });
}
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id); if (!id) return err("Notice not found.", 404);
  const [n] = await db.select().from(notices).where(eq(notices.id, id));
  if (!n) return err("That notice no longer exists.", 404);
  await db.delete(notices).where(eq(notices.id, id));
  return NextResponse.json({ ok: true });
}
