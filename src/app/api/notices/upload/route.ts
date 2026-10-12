import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notices } from "@/db/schema";
import { analyzeNotice } from "@/lib/analyzer";
import { noticeOut, err } from "@/lib/api";
export const dynamic = "force-dynamic";
const MAX = 8 * 1024 * 1024;
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData().catch(()=>null);
    const file = form?.get("file") as File | null;
    if (!file) return err("No file was received. Please choose a PDF file.");
    const name = file.name || "notice.pdf";
    if (!/\.pdf$/i.test(name) && file.type !== "application/pdf") return err("Unsupported file type. NoticePilot currently accepts text-based PDF files (.pdf).");
    if (file.size === 0) return err("That PDF appears to be empty. Please choose a different file.");
    if (file.size > MAX) return err(`That PDF is too large (${(file.size/1048576).toFixed(1)} MB). The limit is 8 MB — try compressing it or pasting the text instead.`);
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.subarray(0,4).toString() !== "%PDF") return err("That file doesn't look like a valid PDF. Please re-export it and try again.");
    let text = "";
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const extracted = await extractText(pdf, { mergePages: true });
      text = (Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text || "").trim();
    } catch { return err("We couldn't read that PDF. It may be corrupted or password-protected. Try pasting the notice text instead.", 422); }
    if (text.length < 30) return err("This PDF has no extractable text — it looks like a scanned image. OCR is not supported yet, so please paste the notice text instead and we'll analyse it right away.", 422);
    const { analysis, engine } = await analyzeNotice(text);
    const [row] = await db.insert(notices).values({ title: analysis.title, summary: analysis.summary, noticeType: analysis.notice_type, issuer: analysis.issuer, rawText: text, source: "pdf", sourceName: name, engine, analysis }).returning();
    return NextResponse.json({ notice: noticeOut(row), engine, extractedChars: text.length }, { status: 201 });
  } catch { return err("Upload failed on our side. Your file wasn't saved — please try again.", 500); }
}
