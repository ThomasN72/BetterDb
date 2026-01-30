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
import { randomUUID } from "crypto";

export interface IStorage {
  getConnections(): Promise<Connection[]>;
  getConnection(id: string): Promise<Connection | undefined>;
  createConnection(data: InsertConnection): Promise<Connection>;
  createConnectionWithId(id: string, data: InsertConnection, createdAt: Date): Promise<Connection>;
  updateConnection(id: string, data: InsertConnection): Promise<Connection | undefined>;
  deleteConnection(id: string): Promise<void>;
  getChatMessages(connectionId: string): Promise<ChatMessage[]>;
  createChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  createChatMessageWithId(id: string, data: InsertChatMessage, createdAt: Date): Promise<ChatMessage>;
  clearChatMessages(connectionId: string): Promise<void>;
  hasConnection(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private connections: Map<string, Connection> = new Map();
  private chatMessages: Map<string, ChatMessage[]> = new Map();

  async getConnections(): Promise<Connection[]> {
    return Array.from(this.connections.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  async getConnection(id: string): Promise<Connection | undefined> {
    return this.connections.get(id);
  }

  async createConnection(data: InsertConnection): Promise<Connection> {
    const connection: Connection = {
      id: randomUUID(),
      name: data.name,
      connectionString: data.connectionString,
      createdAt: new Date(),
    };
    this.connections.set(connection.id, connection);
    return connection;
  }

  async createConnectionWithId(id: string, data: InsertConnection, createdAt: Date): Promise<Connection> {
    const connection: Connection = {
      id,
      name: data.name,
      connectionString: data.connectionString,
      createdAt,
    };
    this.connections.set(id, connection);
    return connection;
  }

  async hasConnection(id: string): Promise<boolean> {
    return this.connections.has(id);
  }

  async updateConnection(id: string, data: InsertConnection): Promise<Connection | undefined> {
    const existing = this.connections.get(id);
    if (!existing) return undefined;
    const updated: Connection = {
      ...existing,
      name: data.name,
      connectionString: data.connectionString,
    };
    this.connections.set(id, updated);
    return updated;
  }

  async deleteConnection(id: string): Promise<void> {
    this.connections.delete(id);
    this.chatMessages.delete(id);
  }

  async getChatMessages(connectionId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(connectionId) || [];
  }

  async createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const connectionId = data.connectionId!;
    const message: ChatMessage = {
      id: randomUUID(),
      connectionId,
      role: data.role,
      content: data.content,
      sqlQuery: data.sqlQuery ?? null,
      queryResults: data.queryResults ?? null,
      createdAt: new Date(),
    };
    const messages = this.chatMessages.get(connectionId) || [];
    messages.push(message);
    this.chatMessages.set(connectionId, messages);
    return message;
  }

  async createChatMessageWithId(id: string, data: InsertChatMessage, createdAt: Date): Promise<ChatMessage> {
    const connectionId = data.connectionId!;
    const message: ChatMessage = {
      id,
      connectionId,
      role: data.role,
      content: data.content,
      sqlQuery: data.sqlQuery ?? null,
      queryResults: data.queryResults ?? null,
      createdAt,
    };
    const messages = this.chatMessages.get(connectionId) || [];
    messages.push(message);
    this.chatMessages.set(connectionId, messages);
    return message;
  }

  async clearChatMessages(connectionId: string): Promise<void> {
    this.chatMessages.delete(connectionId);
  }
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

  async createConnectionWithId(id: string, data: InsertConnection, createdAt: Date): Promise<Connection> {
    const result = await db.insert(connections).values({
      ...data,
      id,
      createdAt,
    } as Connection).returning();
    return result[0];
  }

  async hasConnection(id: string): Promise<boolean> {
    const result = await db
      .select({ id: connections.id })
      .from(connections)
      .where(eq(connections.id, id))
      .limit(1);
    return result.length > 0;
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

  async createChatMessageWithId(id: string, data: InsertChatMessage, createdAt: Date): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values({
      ...data,
      id,
      createdAt,
    } as ChatMessage).returning();
    return result[0];
  }

  async clearChatMessages(connectionId: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.connectionId, connectionId));
  }
}

// Use in-memory storage by default for easy local setup
// Set USE_DATABASE=true environment variable to use PostgreSQL storage
const useDatabase = process.env.USE_DATABASE === "true";

export const storage: IStorage = useDatabase ? new DatabaseStorage() : new MemStorage();

console.log(`[storage] Using ${useDatabase ? "PostgreSQL" : "in-memory"} storage`);
