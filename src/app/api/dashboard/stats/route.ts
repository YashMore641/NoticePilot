import { NextResponse } from "next/server";
import { db } from "@/db";
import { notices, tasks } from "@/db/schema";
import { desc } from "drizzle-orm";
import { taskOut, noticeOut } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET() {
  const ns = await db.select().from(notices).orderBy(desc(notices.createdAt));
  const ts = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  const today = new Date().toISOString().slice(0,10);
  const in30 = new Date(Date.now()+30*864e5).toISOString().slice(0,10);
  const pending = ts.filter(t=>t.status==="pending");
  const withNotice = ts.map(t=>({ ...taskOut(t), noticeTitle: ns.find(n=>n.id===t.noticeId)?.title || (t.noticeId? "Linked notice" : "Personal task") }));
  return NextResponse.json({
    stats: {
      totalNotices: ns.length,
      pendingTasks: pending.length,
      completedTasks: ts.filter(t=>t.status==="completed").length,
      upcomingDeadlines: pending.filter(t=>t.dueDate && t.dueDate>=today && t.dueDate<=in30).length,
      overdueTasks: pending.filter(t=>t.dueDate && t.dueDate<today).length,
    },
    upcoming: withNotice.filter(t=>t.status==="pending" && t.dueDate && t.dueDate>=today).sort((a,b)=>(a.dueDate||"").localeCompare(b.dueDate||"")).slice(0,6),
    overdue: withNotice.filter(t=>t.status==="pending" && t.dueDate && t.dueDate<today).sort((a,b)=>(a.dueDate||"").localeCompare(b.dueDate||"")).slice(0,5),
    recentNotices: ns.slice(0,5).map(n=>({ ...noticeOut(n), actionCount: (n.analysis as any)?.action_items?.length || 0 })),
    engine: (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) ? "gemini" : "local",
  });
}
