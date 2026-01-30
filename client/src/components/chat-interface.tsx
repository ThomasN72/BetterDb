import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Loader2,
  Bot,
  User,
  Copy,
  Check,
  Play,
  Sparkles,
  Database,
  AlertCircle,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QueryResults } from "./query-results";
import { saveMessagesToStorage } from "@/hooks/use-local-storage-sync";
import type { ChatMessage, AIConfig } from "@shared/schema";

interface StreamEvent {
  type: "thinking" | "content" | "done" | "error" | "queryResults" | "queryError";
  data: string | Record<string, unknown>[];
}

interface ChatInterfaceProps {
  connectionId: string | null;
  aiConfig: AIConfig;
  pendingQuery?: string | null;
  onPendingQueryHandled?: () => void;
}

function SQLCodeBlock({ sql, onExecute }: { sql: string; onExecute?: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightSQL = (query: string) => {
    const keywords = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|AS|DISTINCT|COUNT|SUM|AVG|MAX|MIN|CASE|WHEN|THEN|ELSE|END|NULL|NOT|IN|LIKE|BETWEEN|EXISTS|UNION|ALL|PRIMARY|KEY|FOREIGN|REFERENCES)\b/gi;
    const strings = /('[^']*')/g;
    const numbers = /\b(\d+)\b/g;

    return query
      .replace(keywords, '<span class="sql-keyword">$1</span>')
      .replace(strings, '<span class="sql-string">$1</span>')
      .replace(numbers, '<span class="sql-number">$1</span>');
  };

  return (
    <div className="mt-3 rounded-md overflow-hidden border border-border bg-muted/50">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/80 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">SQL Query</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleCopy}
            data-testid="button-copy-sql"
          >
            {copied ? (
              <Check className="h-3 w-3 mr-1" />
            ) : (
              <Copy className="h-3 w-3 mr-1" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          {onExecute && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onExecute}
              data-testid="button-execute-sql"
            >
              <Play className="h-3 w-3 mr-1" />
              Run
            </Button>
          )}
        </div>
      </div>
      <pre className="p-3 overflow-x-auto text-sm font-mono custom-scrollbar">
        <code dangerouslySetInnerHTML={{ __html: highlightSQL(sql) }} />
      </pre>
    </div>
  );
}

function ChatMessageItem({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
      data-testid={`chat-message-${message.id}`}
    >
      <div
        className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-accent text-accent-foreground"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`flex-1 ${isUser ? "flex justify-end" : ""}`}>
        <Card
          className={`max-w-[85%] ${
            isUser ? "bg-primary text-primary-foreground" : "bg-card"
          }`}
        >
          <CardContent className="p-3">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
                {isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                )}
              </p>
            </div>
            {message.sqlQuery && (
              <SQLCodeBlock sql={message.sqlQuery} />
            )}
            {message.queryResults && (
              <div className="mt-3">
                <QueryResults results={message.queryResults as Record<string, unknown>[]} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ChatInterface({ connectionId, aiConfig, pendingQuery, onPendingQueryHandled }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingQueryResults, setStreamingQueryResults] = useState<Record<string, unknown>[] | null>(null);
  const [streamingQueryError, setStreamingQueryError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat", connectionId],
    queryFn: async () => {
      if (!connectionId) return [];
      const res = await fetch(`/api/chat/${connectionId}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!connectionId,
  });

  const sendStreamingMessage = useCallback(async (message: string) => {
    if (!connectionId) return;

    setIsStreaming(true);
    setThinkingStatus("Connecting to AI...");
    setStreamingContent("");
    setStreamingQueryResults(null);
    setStreamingQueryError(null);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, message, aiConfig }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // SSE events are separated by double newlines
        const events = buffer.split("\n\n");
        // Keep the last incomplete chunk in the buffer
        buffer = events.pop() || "";

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;
          
          // Extract data from SSE event format
          const lines = eventBlock.split("\n");
          let data = "";
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              data += line.slice(6);
            }
          }
          
          if (!data) continue;
          
          try {
            const event: StreamEvent = JSON.parse(data);

            switch (event.type) {
              case "thinking":
                setThinkingStatus(event.data as string);
                break;
              case "content":
                setThinkingStatus(null);
                setStreamingContent((prev) => prev + (event.data as string));
                break;
              case "queryResults":
                setStreamingQueryResults(event.data as Record<string, unknown>[]);
                break;
              case "queryError":
                setStreamingQueryError(event.data as string);
                break;
              case "done":
                streamDone = true;
                break;
              case "error":
                throw new Error(event.data as string);
            }
          } catch (parseError) {
            console.warn("Failed to parse SSE event:", data, parseError);
          }
        }
      }

      // Refresh messages after streaming is complete
      queryClient.invalidateQueries({ queryKey: ["/api/chat", connectionId] });
      setInput("");
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
      setThinkingStatus(null);
      setStreamingContent("");
      setStreamingQueryResults(null);
      setStreamingQueryError(null);
    }
  }, [connectionId, aiConfig, queryClient, toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming, streamingContent]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (connectionId) {
      saveMessagesToStorage(connectionId, messages);
    }
  }, [connectionId, messages]);

  // Handle pending query from table preview
  useEffect(() => {
    if (!pendingQuery) return;

    // Always clear the pending query after handling
    const clearQuery = () => onPendingQueryHandled?.();

    if (!connectionId) {
      toast({
        title: "No database connected",
        description: "Please select a database connection first.",
        variant: "destructive",
      });
      clearQuery();
      return;
    }

    if (!aiConfig.apiKey) {
      toast({
        title: "API key required",
        description: "Please configure your AI provider API key in the sidebar.",
        variant: "destructive",
      });
      clearQuery();
      return;
    }

    if (isStreaming) {
      toast({
        title: "Please wait",
        description: "A query is already in progress. Please try again when it completes.",
      });
      clearQuery();
      return;
    }

    sendStreamingMessage(pendingQuery);
    clearQuery();
  }, [pendingQuery, connectionId, aiConfig.apiKey, isStreaming, sendStreamingMessage, onPendingQueryHandled, toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !connectionId || isStreaming) return;
    if (!aiConfig.apiKey) {
      toast({
        title: "API key required",
        description: "Please configure your AI provider API key in the sidebar.",
        variant: "destructive",
      });
      return;
    }
    sendStreamingMessage(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!connectionId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
            <Database className="h-8 w-8 text-accent-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Database Connected</h2>
          <p className="text-muted-foreground text-sm">
            Select a database connection from the sidebar to start chatting with your data.
            You can explore schemas, generate SQL queries, and analyze results using natural language.
          </p>
        </div>
      </div>
    );
  }

  if (!aiConfig.apiKey) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">API Key Required</h2>
          <p className="text-muted-foreground text-sm">
            Please configure your OpenAI or Anthropic API key in the sidebar to start chatting with your database.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {messages.length === 0 && !isLoadingMessages ? (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center max-w-md">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Ready to Explore</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Ask questions about your database in natural language. I'll analyze your schema,
                generate SQL queries, and help you understand your data.
              </p>
              <div className="grid gap-2 text-left">
                <button
                  className="p-3 rounded-md border border-border bg-card text-sm text-left hover-elevate transition-colors"
                  onClick={() => setInput("What tables are in this database and what are their relationships?")}
                  data-testid="suggestion-tables"
                >
                  What tables are in this database?
                </button>
                <button
                  className="p-3 rounded-md border border-border bg-card text-sm text-left hover-elevate transition-colors"
                  onClick={() => setInput("Show me the first 10 rows from each table")}
                  data-testid="suggestion-rows"
                >
                  Show me sample data from each table
                </button>
                <button
                  className="p-3 rounded-md border border-border bg-card text-sm text-left hover-elevate transition-colors"
                  onClick={() => setInput("Help me write a query to find...")}
                  data-testid="suggestion-query"
                >
                  Help me write a custom query
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((msg) => (
              <ChatMessageItem key={msg.id} message={msg} />
            ))}
            {isStreaming && (
              <div className="flex gap-3" data-testid="streaming-message">
                <div className="shrink-0 h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <Card className="max-w-[85%] bg-card">
                  <CardContent className="p-3">
                    {thinkingStatus && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2" data-testid="thinking-indicator">
                        <Brain className="h-4 w-4 animate-pulse text-primary" />
                        <span className="italic">{thinkingStatus}</span>
                      </div>
                    )}
                    {streamingContent && (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {streamingContent}
                          <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
                        </p>
                      </div>
                    )}
                    {!thinkingStatus && !streamingContent && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing...</span>
                      </div>
                    )}
                    {streamingQueryResults && (
                      <div className="mt-3">
                        <QueryResults results={streamingQueryResults} />
                      </div>
                    )}
                    {streamingQueryError && (
                      <div className="mt-3 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                        Query Error: {streamingQueryError}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-border bg-card/50">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your database..."
            className="min-h-[44px] max-h-[120px] resize-none"
            disabled={isStreaming}
            data-testid="input-chat-message"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
            data-testid="button-send-message"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
