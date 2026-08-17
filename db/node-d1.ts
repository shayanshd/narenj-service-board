import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

type SqliteDatabase = InstanceType<typeof Database>;

class NodeD1Statement implements D1PreparedStatement {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly query: string,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new NodeD1Statement(this.database, this.query, values);
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const row = this.database.prepare(this.query).get(...this.values) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const results = this.database.prepare(this.query).all(...this.values) as T[];
    return { results, success: true, meta: {} };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.runSynchronously<T>();
  }

  runSynchronously<T = Record<string, unknown>>(): D1Result<T> {
    const statement = this.database.prepare(this.query);
    if (statement.reader) {
      const results = statement.all(...this.values) as T[];
      return { results, success: true, meta: { changes: 0 } };
    }
    const result = statement.run(...this.values);
    return {
      results: [],
      success: true,
      meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) },
    };
  }
}

export function createNodeD1(): D1Database {
  const configuredPath = process.env.NARENJ_SQLITE_PATH ?? ".data/narenj.sqlite";
  const databasePath = resolve(configuredPath);
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");

  return {
    prepare(query: string) {
      return new NodeD1Statement(database, query);
    },
    async batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]) {
      const execute = database.transaction((items: D1PreparedStatement[]) => items.map((item) => {
        if (!(item instanceof NodeD1Statement)) throw new Error("Invalid database statement");
        return item.runSynchronously<T>();
      }));
      return execute(statements);
    },
  };
}
