import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { answerQuestion, type Analysis } from "@/lib/analyzer";
import { err } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id); if (!id) return err("Notice not found.", 404);
  const body = await req.json().catch(()=>({}));
  const question = String(body.question||"").trim();
  if (!question) return err("Type a question about this notice first.");
  if (question.length > 500) return err("Please keep your question under 500 characters.");
  const [n] = await db.select().from(notices).where(eq(notices.id, id));
  if (!n) return err("That notice no longer exists.", 404);
  const { answer, sources } = answerQuestion(n.analysis as Analysis, n.rawText, question);
  return NextResponse.json({ answer, sources, noticeTitle: n.title });
}
