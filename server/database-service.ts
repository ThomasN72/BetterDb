import pg from "pg";
import type { SchemaInfo, TableSchema, ColumnSchema } from "@shared/schema";

export async function testDatabaseConnection(connectionString: string): Promise<boolean> {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch (error) {
    throw new Error(`Failed to connect: ${(error as Error).message}`);
  } finally {
    await client.end();
  }
}

export async function getDatabaseSchema(connectionString: string): Promise<SchemaInfo> {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();

    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables: TableSchema[] = [];

    for (const row of tablesResult.rows) {
      const tableName = row.table_name;

      const columnsResult = await client.query(`
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
          fk.foreign_table_name || '.' || fk.foreign_column_name as references
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = $1
        ) pk ON c.column_name = pk.column_name
        LEFT JOIN (
          SELECT 
            kcu.column_name,
            ccu.table_name as foreign_table_name,
            ccu.column_name as foreign_column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = $1
        ) fk ON c.column_name = fk.column_name
        WHERE c.table_name = $1
          AND c.table_schema = 'public'
        ORDER BY c.ordinal_position
      `, [tableName]);

      const columns: ColumnSchema[] = columnsResult.rows.map((col) => ({
        name: col.column_name,
        dataType: col.data_type,
        isNullable: col.is_nullable === "YES",
        isPrimaryKey: col.is_primary_key,
        isForeignKey: col.is_foreign_key,
        references: col.references || undefined,
      }));

      tables.push({ tableName, columns });
    }

    return { tables };
  } catch (error) {
    throw new Error(`Failed to fetch schema: ${(error as Error).message}`);
  } finally {
    await client.end();
  }
}

export async function executeQuery(
  connectionString: string,
  query: string
): Promise<Record<string, unknown>[]> {
  const trimmedQuery = query.trim().toUpperCase();
  
  if (
    trimmedQuery.startsWith("DROP") ||
    trimmedQuery.startsWith("TRUNCATE") ||
    (trimmedQuery.startsWith("DELETE") && !trimmedQuery.includes("WHERE"))
  ) {
    throw new Error("Destructive queries are not allowed for safety reasons.");
  }

  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query(query);
    return result.rows || [];
  } catch (error) {
    throw new Error(`Query failed: ${(error as Error).message}`);
  } finally {
    await client.end();
  }
}
