import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AIConfig, SchemaInfo } from "@shared/schema";
import type { Response } from "express";

const SYSTEM_PROMPT = `You are an expert SQL database assistant. Your role is to help users explore and query their database using natural language.

When responding:
1. Always analyze the user's question carefully
2. Use the provided schema information to understand the database structure
3. Generate accurate SQL queries when needed (PostgreSQL syntax)
4. Explain your reasoning and what the query does
5. If the question is ambiguous, ask clarifying questions
6. For complex queries, break them down and explain each part
7. Always prioritize data safety - never suggest destructive queries (DROP, DELETE, TRUNCATE) unless explicitly asked

When generating SQL:
- Use proper PostgreSQL syntax
- Include appropriate JOINs based on relationships
- Use meaningful aliases for tables
- Add comments for complex queries
- Limit results to prevent overwhelming responses (use LIMIT when appropriate)

Format your response as:
1. Brief explanation of what you understood
2. SQL query (if applicable) wrapped in \`\`\`sql ... \`\`\`
3. Explanation of what the query does

If the user asks a question that doesn't require SQL (like explaining a concept or clarifying schema), respond conversationally without generating a query.`;

export interface StreamEvent {
  type: "thinking" | "content" | "done" | "error";
  data: string;
}

export async function generateAIResponse(
  message: string,
  schema: SchemaInfo | null,
  aiConfig: AIConfig,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<{ content: string; sqlQuery?: string }> {
  let fullSystemPrompt: string;
  
  if (schema) {
    const schemaDescription = formatSchemaForAI(schema);
    fullSystemPrompt = `${SYSTEM_PROMPT}

DATABASE SCHEMA:
${schemaDescription}`;
  } else {
    fullSystemPrompt = `${SYSTEM_PROMPT}

DATABASE SCHEMA:
Unable to connect to the database to retrieve schema information. You can still have a general conversation about SQL and databases, but you cannot generate specific queries for this database until the connection is restored.`;
  }

  if (aiConfig.provider === "anthropic") {
    return generateAnthropicResponse(message, fullSystemPrompt, aiConfig.apiKey, conversationHistory);
  } else {
    return generateOpenAIResponse(message, fullSystemPrompt, aiConfig.apiKey, conversationHistory);
  }
}

function formatSchemaForAI(schema: SchemaInfo): string {
  if (!schema.tables || schema.tables.length === 0) {
    return "No tables found in the database.";
  }

  return schema.tables
    .map((table) => {
      const columns = table.columns
        .map((col) => {
          let colDesc = `  - ${col.name}: ${col.dataType}`;
          if (col.isPrimaryKey) colDesc += " (PRIMARY KEY)";
          if (col.isForeignKey && col.references) colDesc += ` (FK -> ${col.references})`;
          if (!col.isNullable) colDesc += " NOT NULL";
          return colDesc;
        })
        .join("\n");
      return `TABLE: ${table.tableName}\n${columns}`;
    })
    .join("\n\n");
}

async function generateAnthropicResponse(
  message: string,
  systemPrompt: string,
  apiKey: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<{ content: string; sqlQuery?: string }> {
  const client = new Anthropic({ apiKey });

  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: message },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";
  const sqlQuery = extractSQLFromResponse(content);

  return { content, sqlQuery };
}

async function generateOpenAIResponse(
  message: string,
  systemPrompt: string,
  apiKey: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<{ content: string; sqlQuery?: string }> {
  const client = new OpenAI({ apiKey });

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: message },
  ];

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages,
    max_tokens: 2048,
  });

  const content = response.choices[0]?.message?.content || "";
  const sqlQuery = extractSQLFromResponse(content);

  return { content, sqlQuery };
}

function extractSQLFromResponse(content: string): string | undefined {
  const sqlMatch = content.match(/```sql\s*([\s\S]*?)```/i);
  if (sqlMatch && sqlMatch[1]) {
    return sqlMatch[1].trim();
  }
  return undefined;
}

export async function streamAIResponse(
  message: string,
  schema: SchemaInfo | null,
  aiConfig: AIConfig,
  conversationHistory: Array<{ role: string; content: string }>,
  res: Response
): Promise<{ content: string; sqlQuery?: string }> {
  let fullSystemPrompt: string;
  
  if (schema) {
    const schemaDescription = formatSchemaForAI(schema);
    fullSystemPrompt = `${SYSTEM_PROMPT}

DATABASE SCHEMA:
${schemaDescription}`;
  } else {
    fullSystemPrompt = `${SYSTEM_PROMPT}

DATABASE SCHEMA:
Unable to connect to the database to retrieve schema information. You can still have a general conversation about SQL and databases, but you cannot generate specific queries for this database until the connection is restored.`; 
  }

  // SSE headers are already set by the route handler
  const sendEvent = (event: StreamEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  sendEvent({ type: "thinking", data: "Connecting to AI..." });

  try {
    let fullContent = "";

    if (aiConfig.provider === "anthropic") {
      fullContent = await streamAnthropicResponse(message, fullSystemPrompt, aiConfig.apiKey, conversationHistory, sendEvent);
    } else {
      fullContent = await streamOpenAIResponse(message, fullSystemPrompt, aiConfig.apiKey, conversationHistory, sendEvent);
    }

    const sqlQuery = extractSQLFromResponse(fullContent);
    // Note: "done" event is sent by the route after query execution

    return { content: fullContent, sqlQuery };
  } catch (error) {
    sendEvent({ type: "error", data: (error as Error).message });
    throw error;
  }
}

async function streamAnthropicResponse(
  message: string,
  systemPrompt: string,
  apiKey: string,
  conversationHistory: Array<{ role: string; content: string }>,
  sendEvent: (event: StreamEvent) => void
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: message },
  ];

  sendEvent({ type: "thinking", data: "Generating response with Claude..." });

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  let fullContent = "";

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      const text = event.delta.text;
      fullContent += text;
      sendEvent({ type: "content", data: text });
    }
  }

  return fullContent;
}

async function streamOpenAIResponse(
  message: string,
  systemPrompt: string,
  apiKey: string,
  conversationHistory: Array<{ role: string; content: string }>,
  sendEvent: (event: StreamEvent) => void
): Promise<string> {
  const client = new OpenAI({ apiKey });

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: message },
  ];

  sendEvent({ type: "thinking", data: "Generating response with GPT-4o..." });

  const stream = await client.chat.completions.create({
    model: "gpt-4o",
    messages,
    max_tokens: 2048,
    stream: true,
  });

  let fullContent = "";

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    if (text) {
      fullContent += text;
      sendEvent({ type: "content", data: text });
    }
  }

  return fullContent;
}
