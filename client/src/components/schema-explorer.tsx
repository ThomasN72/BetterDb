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
  Hash,
  ListTree,
  MoreHorizontal,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { SchemaInfo, TableSchema } from "@shared/schema";

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  title: string;
}

interface SchemaExplorerProps {
  connectionId: string | null;
}

function TableItem({ 
  table, 
  connectionId,
  onQueryResult,
}: { 
  table: TableSchema; 
  connectionId: string;
  onQueryResult: (result: QueryResult) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const runQuery = async (query: string, title: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/connections/${connectionId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Query failed");
      }
      
      const data = await res.json();
      onQueryResult({
        columns: data.columns || [],
        rows: data.rows || [],
        rowCount: data.rowCount || 0,
        title,
      });
    } catch (error) {
      toast({
        title: "Query failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview50 = (e: React.MouseEvent) => {
    e.stopPropagation();
    runQuery(
      `SELECT * FROM "${table.tableName}" LIMIT 50`,
      `${table.tableName} - First 50 rows`
    );
  };

  const handleCount = (e: React.MouseEvent) => {
    e.stopPropagation();
    runQuery(
      `SELECT COUNT(*) as total_rows FROM "${table.tableName}"`,
      `${table.tableName} - Row count`
    );
  };

  const handleStructure = (e: React.MouseEvent) => {
    e.stopPropagation();
    runQuery(
      `SELECT column_name, data_type, is_nullable, column_default 
       FROM information_schema.columns 
       WHERE table_name = '${table.tableName}' 
       ORDER BY ordinal_position`,
      `${table.tableName} - Structure`
    );
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
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              disabled={isLoading}
              data-testid={`button-actions-${table.tableName}`}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={handlePreview50} data-testid={`action-preview-${table.tableName}`}>
              <Eye className="h-4 w-4 mr-2" />
              Preview 50
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCount} data-testid={`action-count-${table.tableName}`}>
              <Hash className="h-4 w-4 mr-2" />
              Count rows
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleStructure} data-testid={`action-structure-${table.tableName}`}>
              <ListTree className="h-4 w-4 mr-2" />
              Structure
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

export function SchemaExplorer({ connectionId }: SchemaExplorerProps) {
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  
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
    <>
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
              <TableItem 
                key={table.tableName} 
                table={table} 
                connectionId={connectionId}
                onQueryResult={setQueryResult}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      <Dialog open={!!queryResult} onOpenChange={(open) => !open && setQueryResult(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5" />
              {queryResult?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {queryResult && queryResult.rows.length > 0 ? (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {queryResult.columns.map((col) => (
                        <th key={col} className="px-3 py-2 text-left font-medium border-b">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.rows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        {queryResult.columns.map((col) => (
                          <td key={col} className="px-3 py-2 font-mono text-xs">
                            {row[col] === null ? (
                              <span className="text-muted-foreground italic">null</span>
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No results
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-2 border-t text-sm text-muted-foreground">
            <span>{queryResult?.rowCount} row(s)</span>
            <Button variant="outline" size="sm" onClick={() => setQueryResult(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
