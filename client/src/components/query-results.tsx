import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

interface QueryResultsProps {
  results: Record<string, unknown>[];
}

export function QueryResults({ results }: QueryResultsProps) {
  const [page, setPage] = useState(0);
  const pageSize = 10;

  if (!results || results.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Query executed successfully. No rows returned.
      </div>
    );
  }

  const columns = Object.keys(results[0] || {});
  const totalPages = Math.ceil(results.length / pageSize);
  const paginatedResults = results.slice(page * pageSize, (page + 1) * pageSize);

  const formatValue = (value: unknown): string => {
    if (value === null) return "NULL";
    if (value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const downloadCSV = () => {
    const headers = columns.join(",");
    const rows = results.map((row) =>
      columns.map((col) => {
        const val = formatValue(row[col]);
        return val.includes(",") || val.includes('"')
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {results.length} row{results.length !== 1 ? "s" : ""}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {columns.length} column{columns.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={downloadCSV}
          data-testid="button-download-csv"
        >
          <Download className="h-3 w-3 mr-1" />
          CSV
        </Button>
      </div>
      <ScrollArea className="max-h-[300px]">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col}
                  className="font-mono text-xs whitespace-nowrap"
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedResults.map((row, i) => (
              <TableRow key={i} data-testid={`result-row-${i}`}>
                {columns.map((col) => (
                  <TableCell
                    key={col}
                    className="font-mono text-xs py-2 max-w-[200px] truncate"
                    title={formatValue(row[col])}
                  >
                    {row[col] === null ? (
                      <span className="text-muted-foreground italic">NULL</span>
                    ) : (
                      formatValue(row[col])
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
