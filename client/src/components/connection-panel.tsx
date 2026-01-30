import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Database, Plus, Trash2, Check, Loader2, Pencil } from "lucide-react";
import { removeConnectionFromStorage } from "@/hooks/use-local-storage-sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { Connection } from "@shared/schema";

const connectionFormSchema = z.object({
  name: z.string().min(1, "Connection name is required"),
  inputMode: z.enum(["url", "fields"]),
  connectionString: z.string().optional(),
  host: z.string().optional(),
  port: z.string().optional(),
  database: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
}).refine((data) => {
  if (data.inputMode === "url") {
    return !!data.connectionString && data.connectionString.length > 0;
  } else {
    return !!data.host && !!data.database && !!data.user;
  }
}, {
  message: "Please fill in all required fields",
  path: ["connectionString"],
});

type ConnectionFormData = z.infer<typeof connectionFormSchema>;

interface ConnectionPanelProps {
  selectedConnectionId: string | null;
  onSelectConnection: (id: string | null) => void;
}

function buildConnectionString(data: ConnectionFormData): string {
  if (data.inputMode === "url") {
    return data.connectionString || "";
  }
  const port = data.port || "5432";
  const password = data.password ? `:${encodeURIComponent(data.password)}` : "";
  return `postgresql://${encodeURIComponent(data.user || "")}${password}@${data.host}:${port}/${data.database}`;
}

function parseConnectionString(url: string): Partial<ConnectionFormData> {
  try {
    const match = url.match(/postgresql:\/\/([^:]+)(?::([^@]*))?@([^:]+):(\d+)\/(.+)/);
    if (match) {
      return {
        user: decodeURIComponent(match[1]),
        password: match[2] ? decodeURIComponent(match[2]) : "",
        host: match[3],
        port: match[4],
        database: match[5],
      };
    }
  } catch {
    // Fall through
  }
  return {};
}

export function ConnectionPanel({
  selectedConnectionId,
  onSelectConnection,
}: ConnectionPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: connections = [], isLoading } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  const form = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionFormSchema),
    defaultValues: {
      name: "",
      inputMode: "fields",
      connectionString: "",
      host: "",
      port: "5432",
      database: "",
      user: "",
      password: "",
    },
  });

  const inputMode = form.watch("inputMode");

  useEffect(() => {
    if (!dialogOpen) {
      setEditingConnection(null);
      form.reset({
        name: "",
        inputMode: "fields",
        connectionString: "",
        host: "",
        port: "5432",
        database: "",
        user: "",
        password: "",
      });
    }
  }, [dialogOpen, form]);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; connectionString: string }) => {
      const response = await apiRequest("POST", "/api/connections", data);
      return { response, originalData: data };
    },
    onSuccess: async ({ response, originalData }) => {
      const newConnection = await response.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      
      // Save to localStorage with full connection string (from form data)
      const storedConnections = JSON.parse(localStorage.getItem("querymind_connections") || "[]");
      storedConnections.push({
        id: newConnection.id,
        name: originalData.name,
        connectionString: originalData.connectionString,
        createdAt: newConnection.createdAt,
      });
      localStorage.setItem("querymind_connections", JSON.stringify(storedConnections));
      
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; connectionString: string } }) => {
      const response = await apiRequest("PUT", `/api/connections/${id}`, data);
      return { id, data, response };
    },
    onSuccess: async ({ id, data: updatedData }) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      
      // Update localStorage directly from form data
      const storedConnections = JSON.parse(localStorage.getItem("querymind_connections") || "[]");
      const updated = storedConnections.map((c: any) =>
        c.id === id ? { ...c, name: updatedData.name, connectionString: updatedData.connectionString } : c
      );
      localStorage.setItem("querymind_connections", JSON.stringify(updated));
      
      form.reset();
      setDialogOpen(false);
      setEditingConnection(null);
      toast({
        title: "Connection updated",
        description: "Your database connection has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update connection",
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
      removeConnectionFromStorage(deletedId);
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

  const handleEditConnection = async (conn: Connection) => {
    const res = await fetch(`/api/connections/${conn.id}/details`);
    if (res.ok) {
      const details = await res.json();
      const parsed = parseConnectionString(details.connectionString);
      setEditingConnection(conn);
      form.reset({
        name: conn.name,
        inputMode: "fields",
        connectionString: details.connectionString,
        host: parsed.host || "",
        port: parsed.port || "5432",
        database: parsed.database || "",
        user: parsed.user || "",
        password: parsed.password || "",
      });
      setDialogOpen(true);
    } else {
      toast({
        title: "Failed to load connection",
        description: "Could not retrieve connection details.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: ConnectionFormData) => {
    const connectionString = buildConnectionString(data);
    const payload = { name: data.name, connectionString };
    
    if (editingConnection) {
      updateMutation.mutate({ id: editingConnection.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

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
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingConnection ? "Edit Connection" : "Add Database Connection"}
              </DialogTitle>
              <DialogDescription>
                Enter your PostgreSQL connection details using individual fields or the full URL.
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

                <Tabs
                  value={inputMode}
                  onValueChange={(v) => form.setValue("inputMode", v as "url" | "fields")}
                  className="w-full"
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="fields" className="flex-1" data-testid="tab-fields">
                      Individual Fields
                    </TabsTrigger>
                    <TabsTrigger value="url" className="flex-1" data-testid="tab-url">
                      Full URL
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="fields" className="space-y-3 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="host"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Host</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="localhost"
                                data-testid="input-host"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Port</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="5432"
                                data-testid="input-port"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="database"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Database Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="mydb"
                              data-testid="input-database"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="user"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="postgres"
                                data-testid="input-user"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                data-testid="input-password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="url" className="mt-4">
                    <FormField
                      control={form.control}
                      name="connectionString"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Connection URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="postgresql://user:password@host:5432/database"
                              data-testid="input-connection-string"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-2">
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
                    disabled={isPending}
                    data-testid="button-save-connection"
                  >
                    {isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingConnection ? "Update Connection" : "Save Connection"}
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
                    handleEditConnection(conn);
                  }}
                  data-testid={`button-edit-connection-${conn.id}`}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
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
