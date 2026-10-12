import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { taskOut, err } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id); if (!id) return err("Task not found.", 404);
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!existing) return err("That task no longer exists.", 404);
  const body = await req.json().catch(()=>({}));
  const patch: any = {};
  if (body.title !== undefined) { const t=String(body.title).trim(); if(!t) return err("Task title can't be empty."); patch.title=t.slice(0,200); }
  if (body.description !== undefined) patch.description = String(body.description).slice(0,600);
  if (body.priority !== undefined && ["high","medium","low"].includes(body.priority)) patch.priority = body.priority;
  if (body.dueDate !== undefined) patch.dueDate = body.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : null;
  if (body.status !== undefined && ["pending","completed"].includes(body.status)) { patch.status = body.status; patch.completedAt = body.status==="completed" ? new Date() : null; }
  const [row] = await db.update(tasks).set(patch).where(eq(tasks.id, id)).returning();
  return NextResponse.json({ task: taskOut(row) });
}
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id); if (!id) return err("Task not found.", 404);
  await db.delete(tasks).where(eq(tasks.id, id));
  return NextResponse.json({ ok: true });
}
