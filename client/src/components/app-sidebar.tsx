import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Database } from "lucide-react";
import { ConnectionPanel } from "./connection-panel";
import { AIConfigPanel } from "./ai-config-panel";
import { SchemaExplorer } from "./schema-explorer";
import type { AIConfig } from "@shared/schema";

interface AppSidebarProps {
  selectedConnectionId: string | null;
  onSelectConnection: (id: string | null) => void;
  aiConfig: AIConfig;
  onAIConfigChange: (config: AIConfig) => void;
}

export function AppSidebar({
  selectedConnectionId,
  onSelectConnection,
  aiConfig,
  onAIConfigChange,
}: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Database className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground">QueryMind</h1>
            <p className="text-xs text-sidebar-foreground/60">AI Database Assistant</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <ConnectionPanel
          selectedConnectionId={selectedConnectionId}
          onSelectConnection={onSelectConnection}
        />

        <SidebarSeparator className="my-4" />

        <AIConfigPanel config={aiConfig} onConfigChange={onAIConfigChange} />

        <SidebarSeparator className="my-4" />

        <SchemaExplorer connectionId={selectedConnectionId} />
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="text-xs text-sidebar-foreground/50 text-center">
          Ask questions in natural language
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
