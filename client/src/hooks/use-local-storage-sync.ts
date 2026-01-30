import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Connection, ChatMessage } from "@shared/schema";

const CONNECTIONS_KEY = "querymind_connections";
const MESSAGES_KEY = "querymind_messages";

interface StoredConnection {
  id: string;
  name: string;
  connectionString: string;
  createdAt: string;
}

interface StoredMessages {
  [connectionId: string]: ChatMessage[];
}

export function saveConnectionsToStorage(connections: Connection[]) {
  try {
    const data: StoredConnection[] = connections.map(c => ({
      id: c.id,
      name: c.name,
      connectionString: c.connectionString,
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : c.createdAt.toISOString(),
    }));
    localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save connections to localStorage:", e);
  }
}

export function loadConnectionsFromStorage(): StoredConnection[] {
  try {
    const data = localStorage.getItem(CONNECTIONS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("Failed to load connections from localStorage:", e);
  }
  return [];
}

interface StoredMessage {
  id: string;
  connectionId: string | null;
  role: string;
  content: string;
  sqlQuery: string | null;
  queryResults: unknown;
  createdAt: string;
}

export function saveMessagesToStorage(connectionId: string, messages: ChatMessage[]) {
  try {
    const allMessages = loadAllMessagesFromStorageRaw();
    allMessages[connectionId] = messages.map(m => ({
      id: m.id,
      connectionId: m.connectionId,
      role: m.role,
      content: m.content,
      sqlQuery: m.sqlQuery,
      queryResults: m.queryResults,
      createdAt: typeof m.createdAt === 'string' ? m.createdAt : m.createdAt.toISOString(),
    }));
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(allMessages));
  } catch (e) {
    console.warn("Failed to save messages to localStorage:", e);
  }
}

function loadAllMessagesFromStorageRaw(): { [connectionId: string]: StoredMessage[] } {
  try {
    const data = localStorage.getItem(MESSAGES_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("Failed to load all messages from localStorage:", e);
  }
  return {};
}

export function loadMessagesFromStorage(connectionId: string): ChatMessage[] {
  try {
    const allMessages = loadAllMessagesFromStorageRaw();
    const msgs = allMessages[connectionId] || [];
    return msgs.map(m => ({
      ...m,
      createdAt: new Date(m.createdAt),
    })) as ChatMessage[];
  } catch (e) {
    console.warn("Failed to load messages from localStorage:", e);
  }
  return [];
}

export function loadAllMessagesFromStorage(): { [connectionId: string]: StoredMessage[] } {
  return loadAllMessagesFromStorageRaw();
}

export function clearMessagesFromStorage(connectionId: string) {
  try {
    const allMessages = loadAllMessagesFromStorageRaw();
    delete allMessages[connectionId];
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(allMessages));
  } catch (e) {
    console.warn("Failed to clear messages from localStorage:", e);
  }
}

export function removeConnectionFromStorage(connectionId: string) {
  try {
    const connections = loadConnectionsFromStorage();
    const filtered = connections.filter(c => c.id !== connectionId);
    localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(filtered));
    clearMessagesFromStorage(connectionId);
  } catch (e) {
    console.warn("Failed to remove connection from localStorage:", e);
  }
}

export function useLocalStorageSync() {
  const queryClient = useQueryClient();
  const hydrated = useRef(false);

  const hydrateFromStorage = useCallback(async () => {
    if (hydrated.current) return;
    hydrated.current = true;

    const storedConnections = loadConnectionsFromStorage();
    const storedMessages = loadAllMessagesFromStorage();

    if (storedConnections.length === 0 && Object.keys(storedMessages).length === 0) {
      return;
    }

    try {
      const response = await fetch("/api/hydrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connections: storedConnections,
          messages: storedMessages,
        }),
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
        console.log("[localStorage] Hydrated server from localStorage");
      }
    } catch (e) {
      console.warn("Failed to hydrate server from localStorage:", e);
    }
  }, [queryClient]);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  return {
    saveConnections: saveConnectionsToStorage,
    saveMessages: saveMessagesToStorage,
    clearMessages: clearMessagesFromStorage,
    removeConnection: removeConnectionFromStorage,
  };
}
