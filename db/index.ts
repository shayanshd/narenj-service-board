import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { createNodeD1 } from "./node-d1";

const database = createNodeD1();

export function getDb() {
  return drizzle(database, { schema });
}

export function getD1() {
  return database;
}
