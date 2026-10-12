import { NextResponse } from "next/server";
export function err(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
export function taskOut(t: any) { return { id: t.id, title: t.title, description: t.description, noticeId: t.noticeId, dueDate: t.dueDate, priority: t.priority, status: t.status, createdAt: t.createdAt, completedAt: t.completedAt }; }
export function noticeOut(n: any) { return { id: n.id, title: n.title, summary: n.summary, noticeType: n.noticeType, issuer: n.issuer, rawText: n.rawText, source: n.source, sourceName: n.sourceName, engine: n.engine, analysis: n.analysis, createdAt: n.createdAt }; }
