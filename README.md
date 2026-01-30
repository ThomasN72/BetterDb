# QueryMind - AI-Powered Database Assistant

A DBeaver-like database management tool with AI-powered natural language querying. Connect to PostgreSQL databases, explore schemas visually, and chat with AI to generate and execute SQL queries.

## Features

- **Database Connections**: Add, edit, test, and manage PostgreSQL connection strings
- **Dual Input Modes**: Enter connections via full URL or individual fields (host, port, database, user, password)
- **Schema Explorer**: Visual tree view of tables, columns, primary keys, and foreign key relationships
- **AI Chat Interface**: Natural language queries that generate and execute SQL
- **Dual AI Support**: Choose between OpenAI (GPT-4o) or Anthropic (Claude Sonnet 4)
- **Query Results**: Paginated table display with CSV export
- **Dark/Light Theme**: Toggle between themes with persistence

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- OpenAI API key and/or Anthropic API key (for AI features)
- PostgreSQL database (optional - for persistent storage)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/querymind.git
   cd querymind
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5050`

That's it! The app uses in-memory storage by default, so no database setup is required.

## Optional: Persistent Storage with PostgreSQL

If you want your connections and chat history to persist between restarts, you can use PostgreSQL:

1. Create a `.env` file:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/querymind
   USE_DATABASE=true
   ```

2. Set up the database tables:
   ```bash
   npm run db:push
   ```

3. Start the app with `npm run dev`

## Usage

### Adding a Database Connection

1. Click the "+" button in the Connections section of the sidebar
2. Enter a name for your connection
3. Choose input mode:
   - **Individual Fields**: Enter host, port, database name, username, and password separately
   - **Full URL**: Paste your complete PostgreSQL connection string
4. Click "Save Connection"

### Configuring AI

1. Expand the "AI Configuration" section in the sidebar
2. Select your AI provider (OpenAI or Anthropic)
3. Enter your API key
4. Click "Save"

### Exploring Database Schema

1. Select a connection from the sidebar
2. The Schema Explorer will display all tables
3. Expand tables to see columns, data types, primary keys, and foreign key relationships

### Chatting with AI

1. Select a connection and configure AI settings
2. Type natural language questions in the chat input
3. The AI will generate SQL queries based on your database schema
4. Review and execute the generated queries
5. View results in the paginated table below

### Example Queries

- "Show me all tables in the database"
- "What are the top 10 customers by order count?"
- "Find all products with price greater than $100"
- "Show the relationship between orders and customers"

## Tech Stack

- **Frontend**: React, TypeScript, TanStack Query, Wouter, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI SDK, Anthropic SDK

## Project Structure

```
client/
  src/
    components/       # React components
    pages/            # Page components
    lib/              # Utilities and query client
    hooks/            # Custom React hooks
server/
  routes.ts           # API endpoints
  storage.ts          # Database storage layer
  db.ts               # Drizzle database connection
  ai-service.ts       # AI provider integration
  database-service.ts # User database introspection
shared/
  schema.ts           # Drizzle schemas and types
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/connections` | List all connections |
| POST | `/api/connections` | Create new connection |
| GET | `/api/connections/:id/details` | Get connection details |
| PUT | `/api/connections/:id` | Update connection |
| DELETE | `/api/connections/:id` | Delete connection |
| POST | `/api/connections/:id/test` | Test connection |
| GET | `/api/connections/:id/schema` | Get database schema |
| GET | `/api/chat/:connectionId/messages` | Get chat history |
| POST | `/api/chat` | Send chat message |
| POST | `/api/connections/:id/query` | Execute raw SQL |

## Security Notes

- Database connection strings are stored encrypted
- API keys are only sent per-request, not stored server-side
- Destructive queries (DROP, TRUNCATE, unfiltered DELETE) are blocked by default

## License

MIT
