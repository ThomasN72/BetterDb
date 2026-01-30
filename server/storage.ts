import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  connections,
  chatMessages,
  type Connection,
  type InsertConnection,
  type ChatMessage,
  type InsertChatMessage,
} from "@shared/schema";

export interface IStorage {
  getConnections(): Promise<Connection[]>;
  getConnection(id: string): Promise<Connection | undefined>;
  createConnection(data: InsertConnection): Promise<Connection>;
  updateConnection(id: string, data: InsertConnection): Promise<Connection | undefined>;
  deleteConnection(id: string): Promise<void>;
  getChatMessages(connectionId: string): Promise<ChatMessage[]>;
  createChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  clearChatMessages(connectionId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getConnections(): Promise<Connection[]> {
    return db.select().from(connections).orderBy(connections.createdAt);
  }

  async getConnection(id: string): Promise<Connection | undefined> {
    const result = await db
      .select()
      .from(connections)
      .where(eq(connections.id, id))
      .limit(1);
    return result[0];
  }

  async createConnection(data: InsertConnection): Promise<Connection> {
    const result = await db.insert(connections).values(data).returning();
    return result[0];
  }

  async updateConnection(id: string, data: InsertConnection): Promise<Connection | undefined> {
    const result = await db
      .update(connections)
      .set(data)
      .where(eq(connections.id, id))
      .returning();
    return result[0];
  }

  async deleteConnection(id: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.connectionId, id));
    await db.delete(connections).where(eq(connections.id, id));
  }

  async getChatMessages(connectionId: string): Promise<ChatMessage[]> {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.connectionId, connectionId))
      .orderBy(chatMessages.createdAt);
  }

  async createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values(data).returning();
    return result[0];
  }

  async clearChatMessages(connectionId: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.connectionId, connectionId));
  }
}

export const storage = new DatabaseStorage();
