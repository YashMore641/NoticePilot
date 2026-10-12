import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notices } from "@/db/schema";
import { desc, ilike, eq, or } from "drizzle-orm";
import { noticeOut, err } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim(); const type = searchParams.get("type");
    let query: any = db.select().from(notices).orderBy(desc(notices.createdAt));
    const rows = await query;
    let out = rows.map(noticeOut);
    if (q) { const s=q.toLowerCase(); out = out.filter((n:any)=> n.title.toLowerCase().includes(s) || n.rawText.toLowerCase().includes(s) || (n.summary||"").toLowerCase().includes(s)); }
    if (type && type!=="all") out = out.filter((n:any)=> n.noticeType===type);
    return NextResponse.json({ notices: out });
  } catch { return err("Could not load notices. Please try again.", 500); }
}
