import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = { title: "NoticePilot — Never Miss a College Deadline", description: "NoticePilot turns college notices and PDFs into evidence-backed deadlines, tasks and answers. Your college life, organized." };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (<html lang="en"><body className="bg-[#f4f7fc] text-[#12264d] antialiased">{children}</body></html>);
}
