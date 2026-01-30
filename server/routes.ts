import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConnectionSchema, chatRequestSchema } from "@shared/schema";
import {
  testDatabaseConnection,
  getDatabaseSchema,
  executeQuery,
} from "./database-service";
import { generateAIResponse, streamAIResponse } from "./ai-service";

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

      // Get schema for AI context (gracefully handle connection failures)
      let schema: Awaited<ReturnType<typeof getDatabaseSchema>> | null = null;
      try {
        schema = await getDatabaseSchema(connection.connectionString);
      } catch (schemaError) {
        console.log("Could not fetch schema, continuing without it:", (schemaError as Error).message);
        schema = null;
      }

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

  // Send a chat message with streaming
  app.post("/api/chat/stream", async (req, res) => {
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

      // Set up SSE headers immediately so client sees response starting
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      // Send immediate thinking status
      res.write(`data: ${JSON.stringify({ type: "thinking", data: "Processing your request..." })}\n\n`);

      // Save user message
      await storage.createChatMessage({
        connectionId,
        role: "user",
        content: message,
      });

      // Send status update while fetching schema
      res.write(`data: ${JSON.stringify({ type: "thinking", data: "Analyzing database schema..." })}\n\n`);

      // Get schema for AI context (gracefully handle connection failures)
      let schema: Awaited<ReturnType<typeof getDatabaseSchema>> | null = null;
      try {
        schema = await getDatabaseSchema(connection.connectionString);
      } catch (schemaError) {
        console.log("Could not fetch schema, continuing without it:", (schemaError as Error).message);
        schema = null;
      }

      // Get conversation history
      const history = await storage.getChatMessages(connectionId);
      const conversationHistory = history.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Send status update before AI call
      res.write(`data: ${JSON.stringify({ type: "thinking", data: "Generating response..." })}\n\n`);

      // Stream AI response (returns content, doesn't send "done" yet)
      const aiResponse = await streamAIResponse(
        message,
        schema,
        aiConfig,
        conversationHistory.slice(0, -1),
        res
      );

      // Execute SQL if generated
      let queryResults: Record<string, unknown>[] | undefined;
      if (aiResponse.sqlQuery) {
        try {
          queryResults = await executeQuery(
            connection.connectionString,
            aiResponse.sqlQuery
          );
          // Send query results
          res.write(`data: ${JSON.stringify({ type: "queryResults", data: queryResults })}\n\n`);
        } catch (error) {
          res.write(`data: ${JSON.stringify({ type: "queryError", data: (error as Error).message })}\n\n`);
        }
      }

      // Save AI response
      await storage.createChatMessage({
        connectionId,
        role: "assistant",
        content: aiResponse.content,
        sqlQuery: aiResponse.sqlQuery,
        queryResults: queryResults || null,
      });

      // Send final done event after all processing
      res.write(`data: ${JSON.stringify({ type: "done", data: "" })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Stream chat error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: (error as Error).message });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", data: (error as Error).message })}\n\n`);
        res.end();
      }
    }
  });

  // Hydrate storage from localStorage (client-side persistence)
  // This is a single-user local tool, so hydration is safe for localhost use
  app.post("/api/hydrate", async (req, res) => {
    try {
      const { connections: storedConnections, messages: storedMessages } = req.body;
      let connectionsRestored = 0;
      let messagesRestored = 0;

      // Validate and restore connections
      if (Array.isArray(storedConnections)) {
        for (const conn of storedConnections) {
          // Validate required fields
          if (
            typeof conn.id !== "string" ||
            typeof conn.name !== "string" ||
            typeof conn.connectionString !== "string" ||
            !conn.id || !conn.name || !conn.connectionString
          ) {
            continue;
          }
          
          const exists = await storage.hasConnection(conn.id);
          if (!exists) {
            await storage.createConnectionWithId(
              conn.id,
              { name: conn.name, connectionString: conn.connectionString },
              new Date(conn.createdAt || Date.now())
            );
            connectionsRestored++;
          }
        }
      }

      // Validate and restore messages
      if (storedMessages && typeof storedMessages === "object") {
        for (const [connectionId, msgs] of Object.entries(storedMessages)) {
          if (!Array.isArray(msgs) || typeof connectionId !== "string") continue;
          
          // Check if connection exists before restoring messages
          const connectionExists = await storage.hasConnection(connectionId);
          if (!connectionExists) continue;
          
          const existingMessages = await storage.getChatMessages(connectionId);
          const existingIds = new Set(existingMessages.map(m => m.id));
          
          for (const msg of msgs as any[]) {
            // Validate required fields
            if (
              typeof msg.id !== "string" ||
              typeof msg.role !== "string" ||
              typeof msg.content !== "string" ||
              !msg.id || !msg.role || !msg.content ||
              !["user", "assistant"].includes(msg.role)
            ) {
              continue;
            }
            
            // Skip if message already exists
            if (existingIds.has(msg.id)) continue;
            
            await storage.createChatMessageWithId(
              msg.id,
              {
                connectionId,
                role: msg.role,
                content: msg.content,
                sqlQuery: typeof msg.sqlQuery === "string" ? msg.sqlQuery : null,
                queryResults: Array.isArray(msg.queryResults) ? msg.queryResults : null,
              },
              new Date(msg.createdAt || Date.now())
            );
            messagesRestored++;
          }
        }
      }

      console.log(`[hydrate] Restored ${connectionsRestored} connections, ${messagesRestored} messages from localStorage`);
      res.json({ success: true, connectionsRestored, messagesRestored });
    } catch (error) {
      console.error("Hydration error:", error);
      res.status(500).json({ error: "Failed to hydrate from localStorage" });
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
