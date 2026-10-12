import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  noticeType: text("notice_type").notNull().default("other"),
  issuer: text("issuer"),
  rawText: text("raw_text").notNull(),
  source: text("source").notNull().default("paste"), // paste | pdf
  sourceName: text("source_name"),
  engine: text("engine").notNull().default("local"), // gemini | local
  analysis: jsonb("analysis").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  noticeId: integer("notice_id").references(() => notices.id, { onDelete: "set null" }),
  dueDate: text("due_date"), // YYYY-MM-DD or null — never fabricated
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("pending"), // pending | completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type NoticeRow = typeof notices.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
