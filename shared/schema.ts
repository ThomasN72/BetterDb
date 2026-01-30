import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const connections = pgTable("connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  connectionString: text("connection_string").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConnectionSchema = createInsertSchema(connections).pick({
  name: true,
  connectionString: true,
});

export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").references(() => connections.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  sqlQuery: text("sql_query"),
  queryResults: jsonb("query_results"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  connectionId: true,
  role: true,
  content: true,
  sqlQuery: true,
  queryResults: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const aiConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  apiKey: z.string().min(1, "API key is required"),
  model: z.string().optional(),
});

export type AIConfig = z.infer<typeof aiConfigSchema>;

export const chatRequestSchema = z.object({
  connectionId: z.string(),
  message: z.string().min(1),
  aiConfig: aiConfigSchema,
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export interface TableSchema {
  tableName: string;
  columns: ColumnSchema[];
}

export interface ColumnSchema {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: string;
}

export interface SchemaInfo {
  tables: TableSchema[];
}
