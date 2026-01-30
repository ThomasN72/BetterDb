import { useQuery } from "@tanstack/react-query";
import {
  Table2,
  ChevronDown,
  ChevronRight,
  Key,
  Link2,
  Loader2,
  AlertCircle,
  Eye,
} from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SchemaInfo, TableSchema } from "@shared/schema";

interface SchemaExplorerProps {
  connectionId: string | null;
  onPreviewTable?: (tableName: string) => void;
}

function TableItem({ table, onPreview }: { table: TableSchema; onPreview?: (tableName: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPreview?.(table.tableName);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-1 group">
        <CollapsibleTrigger
          className="flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md hover-elevate text-left text-sm"
          data-testid={`table-${table.tableName}`}
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          <Table2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-medium">{table.tableName}</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {table.columns.length}
          </Badge>
        </CollapsibleTrigger>
        {onPreview && (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={handlePreview}
            title="Preview first 50 rows"
            data-testid={`button-preview-${table.tableName}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </div>
      <CollapsibleContent className="ml-5 pl-2 border-l border-sidebar-border">
        <div className="space-y-0.5 py-1">
          {table.columns.map((col) => (
            <div
              key={col.name}
              className="flex items-center gap-2 px-2 py-1 text-xs text-sidebar-foreground/70"
              data-testid={`column-${table.tableName}-${col.name}`}
            >
              <span className="flex items-center gap-1.5 flex-1 min-w-0">
                {col.isPrimaryKey && (
                  <Key className="h-3 w-3 text-amber-500 shrink-0" />
                )}
                {col.isForeignKey && (
                  <Link2 className="h-3 w-3 text-blue-500 shrink-0" />
                )}
                <span className="truncate">{col.name}</span>
              </span>
              <span className="text-sidebar-foreground/50 font-mono text-xs shrink-0">
                {col.dataType}
              </span>
              {col.isNullable && (
                <span className="text-sidebar-foreground/40 text-xs shrink-0">
                  null
                </span>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SchemaExplorer({ connectionId, onPreviewTable }: SchemaExplorerProps) {
  const { data: schema, isLoading, error } = useQuery<SchemaInfo>({
    queryKey: ["/api/connections", connectionId, "schema"],
    queryFn: async () => {
      const res = await fetch(`/api/connections/${connectionId}/schema`);
      if (!res.ok) throw new Error("Failed to fetch schema");
      return res.json();
    },
    enabled: !!connectionId,
  });

  if (!connectionId) {
    return (
      <div className="text-center py-6 px-2">
        <Table2 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-xs text-muted-foreground">No connection selected</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Select a database to view schema
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 px-2">
        <AlertCircle className="h-8 w-8 mx-auto text-destructive/70 mb-2" />
        <p className="text-xs text-muted-foreground">Failed to load schema</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Check your connection
        </p>
      </div>
    );
  }

  if (!schema || schema.tables.length === 0) {
    return (
      <div className="text-center py-6 px-2">
        <Table2 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-xs text-muted-foreground">No tables found</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Database appears to be empty
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-sidebar-foreground/80">
          Schema Explorer
        </h3>
        <Badge variant="secondary" className="text-xs">
          {schema.tables.length} tables
        </Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-420px)]">
        <div className="space-y-0.5">
          {schema.tables.map((table) => (
            <TableItem key={table.tableName} table={table} onPreview={onPreviewTable} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
