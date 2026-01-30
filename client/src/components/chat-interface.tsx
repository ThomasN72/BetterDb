import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { QueryResults } from "./query-results";
import type { ChatMessage, AIConfig } from "@shared/schema";

interface ChatInterfaceProps {
  connectionId: string | null;
  aiConfig: AIConfig;
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

export function ChatInterface({ connectionId, aiConfig }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
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

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/chat", {
        connectionId,
        message,
        aiConfig,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat", connectionId] });
      setInput("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !connectionId || chatMutation.isPending) return;
    if (!aiConfig.apiKey) {
      toast({
        title: "API key required",
        description: "Please configure your AI provider API key in the sidebar.",
        variant: "destructive",
      });
      return;
    }
    chatMutation.mutate(input.trim());
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
            {chatMutation.isPending && (
              <div className="flex gap-3">
                <div className="shrink-0 h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <Card className="max-w-[85%] bg-card">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analyzing your question...</span>
                    </div>
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
            disabled={chatMutation.isPending}
            data-testid="input-chat-message"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || chatMutation.isPending}
            data-testid="button-send-message"
          >
            {chatMutation.isPending ? (
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
