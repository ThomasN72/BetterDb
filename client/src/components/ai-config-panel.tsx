import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bot, Key, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { aiConfigSchema, type AIConfig } from "@shared/schema";

interface AIConfigPanelProps {
  config: AIConfig;
  onConfigChange: (config: AIConfig) => void;
}

export function AIConfigPanel({ config, onConfigChange }: AIConfigPanelProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  const form = useForm({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: config,
    values: config,
  });

  const handleProviderChange = (provider: "openai" | "anthropic") => {
    const newConfig = { ...config, provider };
    onConfigChange(newConfig);
  };

  const handleApiKeyChange = (apiKey: string) => {
    const newConfig = { ...config, apiKey };
    onConfigChange(newConfig);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-sidebar-foreground/80">
          AI Configuration
        </h3>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs text-sidebar-foreground/70">Provider</Label>
          <Select
            value={config.provider}
            onValueChange={(v) => handleProviderChange(v as "openai" | "anthropic")}
          >
            <SelectTrigger
              className="bg-sidebar-accent/50 border-sidebar-border text-sm"
              data-testid="select-ai-provider"
            >
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai" data-testid="option-openai">
                OpenAI (GPT-4o)
              </SelectItem>
              <SelectItem value="anthropic" data-testid="option-anthropic">
                Anthropic (Claude)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-sidebar-foreground/70">API Key</Label>
          <div className="relative">
            <Input
              type={showApiKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder={
                config.provider === "openai"
                  ? "sk-..."
                  : "sk-ant-..."
              }
              className="bg-sidebar-accent/50 border-sidebar-border text-sm pr-10"
              data-testid="input-api-key"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full w-10"
              onClick={() => setShowApiKey(!showApiKey)}
              data-testid="button-toggle-api-key"
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-sidebar-foreground/50">
            {config.provider === "openai"
              ? "Your OpenAI API key for GPT models"
              : "Your Anthropic API key for Claude models"}
          </p>
        </div>

        {config.apiKey && (
          <div className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sidebar-foreground/70">API key configured</span>
          </div>
        )}
      </div>
    </div>
  );
}
