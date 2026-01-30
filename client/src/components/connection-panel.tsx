import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Database, Plus, Trash2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { Connection } from "@shared/schema";

const connectionFormSchema = z.object({
  name: z.string().min(1, "Connection name is required"),
  connectionString: z.string().min(1, "Connection string is required"),
});

interface ConnectionPanelProps {
  selectedConnectionId: string | null;
  onSelectConnection: (id: string | null) => void;
}

export function ConnectionPanel({
  selectedConnectionId,
  onSelectConnection,
}: ConnectionPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: connections = [], isLoading } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const form = useForm({
    resolver: zodResolver(connectionFormSchema),
    defaultValues: {
      name: "",
      connectionString: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof connectionFormSchema>) => {
      return apiRequest("POST", "/api/connections", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      form.reset();
      setDialogOpen(false);
      toast({
        title: "Connection created",
        description: "Your database connection has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create connection",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/connections/${id}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      if (selectedConnectionId === deletedId) {
        onSelectConnection(null);
      }
      toast({
        title: "Connection deleted",
        description: "Your database connection has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete connection",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/connections/${id}/test`);
    },
    onSuccess: () => {
      toast({
        title: "Connection successful",
        description: "Successfully connected to the database.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof connectionFormSchema>) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-sidebar-foreground/80">
          Connections
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              data-testid="button-add-connection"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Database Connection</DialogTitle>
              <DialogDescription>
                Enter your PostgreSQL connection details to connect to your database.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Connection Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="My Database"
                          data-testid="input-connection-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="connectionString"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Connection String</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="postgresql://user:password@host:5432/database"
                          type="password"
                          data-testid="input-connection-string"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    data-testid="button-cancel-connection"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-save-connection"
                  >
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Connection
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-6 px-2">
          <Database className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-xs text-muted-foreground">No connections yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Add a database to get started
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className={`group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors hover-elevate ${
                selectedConnectionId === conn.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:text-sidebar-foreground"
              }`}
              onClick={() => onSelectConnection(conn.id)}
              data-testid={`connection-item-${conn.id}`}
            >
              <Database className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-sm">{conn.name}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    testMutation.mutate(conn.id);
                  }}
                  disabled={testMutation.isPending}
                  data-testid={`button-test-connection-${conn.id}`}
                >
                  {testMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(conn.id);
                  }}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-connection-${conn.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
