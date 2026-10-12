import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notices } from "@/db/schema";
import { analyzeNotice } from "@/lib/analyzer";
import { noticeOut, err } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(()=>({}));
    const text = String(body.text||"").trim();
    if (!text) return err("Please paste a notice or upload a PDF first — the notice text is empty.");
    if (text.length < 30) return err("That text looks too short to be a college notice. Paste the full notice so deadlines aren't missed.");
    if (text.length > 60000) return err("This notice is very long (over 60,000 characters). Please paste the relevant section.");
    const { analysis, engine } = await analyzeNotice(text);
    const [row] = await db.insert(notices).values({ title: analysis.title, summary: analysis.summary, noticeType: analysis.notice_type, issuer: analysis.issuer, rawText: text, source: body.source==="pdf"?"pdf":"paste", sourceName: body.sourceName||null, engine, analysis }).returning();
    return NextResponse.json({ notice: noticeOut(row), engine }, { status: 201 });
  } catch { return err("Analysis failed. Your text is preserved — please try again in a moment.", 500); }
}
