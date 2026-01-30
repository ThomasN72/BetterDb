import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConnectionSchema, chatRequestSchema } from "@shared/schema";
import {
  testDatabaseConnection,
  getDatabaseSchema,
  executeQuery,
} from "./database-service";
import { generateAIResponse } from "./ai-service";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all connections
  app.get("/api/connections", async (req, res) => {
    try {
      const connections = await storage.getConnections();
      const safeConnections = connections.map((c) => ({
        ...c,
        connectionString: "***hidden***",
      }));
      res.json(safeConnections);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch connections" });
    }
  });

  // Create a new connection
  app.post("/api/connections", async (req, res) => {
    try {
      const parsed = insertConnectionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const connection = await storage.createConnection(parsed.data);
      res.json({
        ...connection,
        connectionString: "***hidden***",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create connection" });
    }
  });

  // Get connection details (for editing)
  app.get("/api/connections/:id/details", async (req, res) => {
    try {
      const connection = await storage.getConnection(req.params.id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json(connection);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch connection" });
    }
  });

  // Update a connection
  app.put("/api/connections/:id", async (req, res) => {
    try {
      const parsed = insertConnectionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const connection = await storage.updateConnection(req.params.id, parsed.data);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json({
        ...connection,
        connectionString: "***hidden***",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update connection" });
    }
  });

  // Delete a connection
  app.delete("/api/connections/:id", async (req, res) => {
    try {
      await storage.deleteConnection(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete connection" });
    }
  });

  // Test a connection
  app.post("/api/connections/:id/test", async (req, res) => {
    try {
      const connection = await storage.getConnection(req.params.id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      await testDatabaseConnection(connection.connectionString);
      res.json({ success: true, message: "Connection successful" });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Get database schema
  app.get("/api/connections/:id/schema", async (req, res) => {
    try {
      const connection = await storage.getConnection(req.params.id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      const schema = await getDatabaseSchema(connection.connectionString);
      res.json(schema);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Get chat messages for a connection
  app.get("/api/chat/:connectionId/messages", async (req, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.connectionId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Send a chat message
  app.post("/api/chat", async (req, res) => {
    try {
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const { connectionId, message, aiConfig } = parsed.data;

      const connection = await storage.getConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // Save user message
      await storage.createChatMessage({
        connectionId,
        role: "user",
        content: message,
      });

      // Get schema for AI context
      const schema = await getDatabaseSchema(connection.connectionString);

      // Get conversation history
      const history = await storage.getChatMessages(connectionId);
      const conversationHistory = history.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Generate AI response
      const aiResponse = await generateAIResponse(
        message,
        schema,
        aiConfig,
        conversationHistory.slice(0, -1) // Exclude the just-added user message
      );

      // Execute SQL if generated
      let queryResults: Record<string, unknown>[] | undefined;
      if (aiResponse.sqlQuery) {
        try {
          queryResults = await executeQuery(
            connection.connectionString,
            aiResponse.sqlQuery
          );
        } catch (error) {
          aiResponse.content += `\n\n**Query Error:** ${(error as Error).message}`;
        }
      }

      // Save AI response
      const assistantMessage = await storage.createChatMessage({
        connectionId,
        role: "assistant",
        content: aiResponse.content,
        sqlQuery: aiResponse.sqlQuery,
        queryResults: queryResults || null,
      });

      res.json(assistantMessage);
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Execute a query directly
  app.post("/api/connections/:id/query", async (req, res) => {
    try {
      const connection = await storage.getConnection(req.params.id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      const { query } = req.body;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query is required" });
      }

      const results = await executeQuery(connection.connectionString, query);
      res.json({ results });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  return httpServer;
}
