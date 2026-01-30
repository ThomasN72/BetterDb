# QueryMind - AI-Powered Database Assistant

A DBeaver-like database management tool with AI-powered natural language querying. Connect to PostgreSQL databases, explore schemas visually, and chat with AI to generate and execute SQL queries.

![Main Interface](docs/screenshots/main-interface.png)

## Features

- **Database Connections**: Add, edit, test, and manage PostgreSQL connection strings
- **Dual Input Modes**: Enter connections via full URL or individual fields (host, port, database, user, password)
- **Schema Explorer**: Visual tree view of tables, columns, primary keys, and foreign key relationships
- **AI Chat Interface**: Natural language queries that generate and execute SQL
- **Dual AI Support**: Choose between OpenAI (GPT-4o) or Anthropic (Claude Sonnet 4)
- **Streaming Responses**: Real-time AI responses with thinking indicators
- **Query Results**: Paginated table display with CSV export
- **Dark/Light Theme**: Toggle between themes with persistence
- **Local Persistence**: Connections and chat history saved to localStorage

## Screenshots

### Adding a Database Connection
![Add Connection](docs/screenshots/add-connection.png)
*Dialog for adding a new PostgreSQL database connection with name and connection string*

### Chatting with AI
![Chat with AI](docs/screenshots/chat-with-ai.png)
*Natural language conversation with AI to explore your database and generate SQL queries*

## Getting Started

### 1. Add a Database Connection

1. Click the **+** button next to "Connections" in the sidebar
2. Enter a name for your connection (e.g., "Production DB")
3. Enter your PostgreSQL connection string:
   ```
   postgresql://username:password@host:port/database
   ```
4. Click **Save**

> **Note**: The app runs on cloud servers, so you need a publicly accessible database. Local databases (localhost, 127.0.0.1) won't work from Replit.

### 2. Configure AI Provider

1. In the **AI Configuration** section, select your provider:
   - **OpenAI** - Uses GPT-4o
   - **Anthropic** - Uses Claude Sonnet 4
2. Enter your API key
3. The green indicator shows when the key is configured

### 3. Start Chatting

1. Click on your connection to select it
2. The schema explorer will load your database tables
3. Type a question in natural language, like:
   - "What tables are in this database?"
   - "Show me all users created this month"
   - "Find the top 10 products by sales"
4. The AI will generate and execute SQL queries for you

## Installation

### Quick Start (No Database Required)

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

4. Open your browser and navigate to `http://localhost:5000`

The app uses in-memory storage by default with localStorage persistence, so no database setup is required.

### Optional: PostgreSQL Persistence

If you want server-side persistence between restarts:

1. Create a `.env` file:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/querymind
   USE_DATABASE=true
   ```

2. Set up the database tables:
   ```bash
   npm run db:push
   ```

## Example Queries

- "Show me all tables in the database"
- "What are the top 10 customers by order count?"
- "Find all products with price greater than $100"
- "Show the relationship between orders and customers"
- "Count records in each table"

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
| POST | `/api/chat/stream` | Send chat message (streaming) |
| POST | `/api/connections/:id/query` | Execute raw SQL |

## Security Notes

- Database connection strings are stored securely and masked in the UI
- API keys are only sent per-request, not stored server-side
- Destructive queries (DROP, TRUNCATE, unfiltered DELETE) are blocked by default

## License

MIT License - see [LICENSE](LICENSE) for details.
