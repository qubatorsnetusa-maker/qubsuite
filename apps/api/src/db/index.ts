import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

export type Schema = typeof schema;
export type Database = PostgresJsDatabase<Schema>;
export type Transaction = PgTransaction<PostgresJsQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
/** Anything that can run queries: the pool or an open transaction. Repositories accept this. */
export type Executor = Database | Transaction;

export interface DbHandle {
  db: Database;
  sql: postgres.Sql;
  close(): Promise<void>;
}

export function createDb(url: string, options: { max?: number } = {}): DbHandle {
  const client = postgres(url, {
    max: options.max ?? 10,
    idle_timeout: 30,
    connect_timeout: 10,
    // Notices (e.g. "relation already exists, skipping") are noise in application logs.
    onnotice: () => {},
  });
  const db = drizzle(client, { schema, casing: 'snake_case' });
  return { db, sql: client, close: () => client.end({ timeout: 5 }) };
}

export { schema };
