import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { taskOut, err } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); const priority = searchParams.get("priority");
    let rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    if (status && status!=="all") rows = rows.filter(r=>r.status===status);
    if (priority && priority!=="all") rows = rows.filter(r=>r.priority===priority);
    rows.sort((a,b)=>{ if(a.status!==b.status) return a.status==="pending"?-1:1; const da=a.dueDate||"9999-12-31", dbb=b.dueDate||"9999-12-31"; return da.localeCompare(dbb); });
    return NextResponse.json({ tasks: rows.map(taskOut) });
  } catch { return err("Could not load tasks.", 500); }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(()=>({}));
    const title = String(body.title||"").trim();
    if (!title) return err("Give your task a title first.");
    if (title.length>200) return err("Task title is too long (max 200 characters).");
    const dueDate = body.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : null;
    const priority = ["high","medium","low"].includes(body.priority) ? body.priority : "medium";
    const noticeId = body.noticeId ? Number(body.noticeId) : null;
    if (noticeId) {
      const existing = await db.select().from(tasks).where(and(eq(tasks.noticeId, noticeId), eq(tasks.title, title)));
      if (existing.length) return err("This action is already in My Tasks — no duplicate created. Find it in your task list.", 409);
    }
    const [row] = await db.insert(tasks).values({ title, description: String(body.description||"").slice(0,600), noticeId, dueDate, priority, status: "pending" }).returning();
    return NextResponse.json({ task: taskOut(row) }, { status: 201 });
  } catch { return err("Could not save that task. Please try again.", 500); }
}
