# QueryMind - AI-Powered Database Assistant

## Overview
QueryMind is a DBeaver-like database management tool with AI-powered natural language querying. Users can connect to PostgreSQL databases, explore schemas visually, and chat with AI (OpenAI GPT-4o or Anthropic Claude) to generate and execute SQL queries.

## Core Features
- **Database Connections**: Add, test, and manage PostgreSQL connection strings
- **Schema Explorer**: Visual tree view of tables, columns, primary keys, and foreign key relationships
- **AI Chat Interface**: Natural language queries that generate and execute SQL
- **Dual AI Support**: Choose between OpenAI (GPT-4o) or Anthropic (Claude Sonnet 4) providers
- **Query Results**: Paginated table display with CSV export
- **Dark/Light Theme**: Toggle between themes with persistence

## Tech Stack
- **Frontend**: React, TypeScript, TanStack Query, Wouter, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI SDK, Anthropic SDK

## Project Structure
```
client/
  src/
    components/
      app-sidebar.tsx      - Main sidebar with connections, AI config, schema
      chat-interface.tsx   - Chat UI with messages, input, suggestions
      connection-panel.tsx - Database connection management
      ai-config-panel.tsx  - AI provider and API key settings
      schema-explorer.tsx  - Database schema tree view
      query-results.tsx    - Query result table with pagination
      theme-toggle.tsx     - Dark/light mode toggle
    pages/
      home.tsx             - Main application page
    lib/
      queryClient.ts       - TanStack Query configuration
server/
  routes.ts               - API endpoints
  storage.ts              - Database storage layer
  db.ts                   - Drizzle database connection
  ai-service.ts           - OpenAI/Anthropic integration
  database-service.ts     - User database introspection
shared/
  schema.ts               - Drizzle schemas and types
```

## API Endpoints
- `GET /api/connections` - List all connections
- `POST /api/connections` - Create new connection
- `DELETE /api/connections/:id` - Delete connection
- `POST /api/connections/:id/test` - Test connection
- `GET /api/connections/:id/schema` - Get database schema
- `GET /api/chat/:connectionId/messages` - Get chat history
- `POST /api/chat` - Send chat message (requires AI config)
- `POST /api/connections/:id/query` - Execute raw SQL

## User Preferences
- Theme preference saved to localStorage
- AI provider configuration saved to localStorage
- Default to dark mode

## Security Notes
- User database connection strings stored encrypted in app database
- API keys only sent per-request, not stored server-side
- Destructive queries (DROP, TRUNCATE, unfiltered DELETE) blocked by default
