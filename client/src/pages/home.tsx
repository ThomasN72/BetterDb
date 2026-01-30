import { useState, useEffect, useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AIConfig } from "@shared/schema";

export default function Home() {
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [aiConfig, setAIConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem("aiConfig");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { provider: "openai", apiKey: "" };
      }
    }
    return { provider: "openai", apiKey: "" };
  });

  useEffect(() => {
    localStorage.setItem("aiConfig", JSON.stringify(aiConfig));
  }, [aiConfig]);

  const handlePreviewTable = useCallback((tableName: string) => {
    setPendingQuery(`Show me the first 50 rows from the "${tableName}" table`);
  }, []);

  const handlePendingQueryHandled = useCallback(() => {
    setPendingQuery(null);
  }, []);

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          selectedConnectionId={selectedConnectionId}
          onSelectConnection={setSelectedConnectionId}
          aiConfig={aiConfig}
          onAIConfigChange={setAIConfig}
          onPreviewTable={handlePreviewTable}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-card/50">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="h-4 w-px bg-border" />
              <span className="text-sm font-medium">
                {selectedConnectionId ? "Chat" : "Welcome"}
              </span>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-hidden bg-background">
            <ChatInterface
              connectionId={selectedConnectionId}
              aiConfig={aiConfig}
              pendingQuery={pendingQuery}
              onPendingQueryHandled={handlePendingQueryHandled}
            />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
