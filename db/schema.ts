import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const restaurants = sqliteTable("restaurants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const branches = sqliteTable("branches", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => restaurants.id),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Tehran"),
}, (table) => [index("idx_branches_restaurant").on(table.restaurantId)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
});

export const memberships = sqliteTable("memberships", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  restaurantId: text("restaurant_id").notNull().references(() => restaurants.id),
  branchId: text("branch_id").references(() => branches.id),
  role: text("role", { enum: ["manager", "waiter", "kitchen"] }).notNull(),
}, (table) => [
  uniqueIndex("uq_membership_user_restaurant_branch").on(table.userId, table.restaurantId, table.branchId),
  index("idx_memberships_restaurant_user").on(table.restaurantId, table.userId),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_sessions_token_expiry").on(table.tokenHash, table.expiresAt)]);

export const diningTables = sqliteTable("dining_tables", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => restaurants.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  number: integer("number").notNull(),
  seats: integer("seats").notNull(),
  area: text("area").notNull().default("سالن اصلی"),
}, (table) => [
  uniqueIndex("uq_tables_branch_number").on(table.restaurantId, table.branchId, table.number),
  index("idx_tables_restaurant_branch").on(table.restaurantId, table.branchId),
]);

export const menuCategories = sqliteTable("menu_categories", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => restaurants.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [index("idx_menu_categories_restaurant").on(table.restaurantId)]);

export const menuItems = sqliteTable("menu_items", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => restaurants.id),
  branchId: text("branch_id").references(() => branches.id),
  categoryId: text("category_id").notNull().references(() => menuCategories.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priceRials: integer("price_rials").notNull(),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
  version: integer("version").notNull().default(1),
}, (table) => [
  index("idx_menu_items_restaurant_branch").on(table.restaurantId, table.branchId),
  index("idx_menu_items_category").on(table.restaurantId, table.categoryId),
]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => restaurants.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  tableId: text("table_id").notNull().references(() => diningTables.id),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  openedBy: text("opened_by").notNull().references(() => users.id),
  openedAt: text("opened_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  closedAt: text("closed_at"),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("uq_orders_open_table").on(table.restaurantId, table.branchId, table.tableId).where(sql`${table.status} = 'open'`),
  index("idx_orders_restaurant_branch_status").on(table.restaurantId, table.branchId, table.status),
  index("idx_orders_restaurant_table_status").on(table.restaurantId, table.tableId, table.status),
]);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => restaurants.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  orderId: text("order_id").notNull().references(() => orders.id),
  menuItemId: text("menu_item_id").notNull().references(() => menuItems.id),
  itemName: text("item_name").notNull(),
  unitPriceRials: integer("unit_price_rials").notNull(),
  quantity: integer("quantity").notNull(),
  note: text("note").notNull().default(""),
  status: text("status", { enum: ["new", "preparing", "ready", "served", "cancelled"] }).notNull().default("new"),
  version: integer("version").notNull().default(1),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_order_items_restaurant_order").on(table.restaurantId, table.orderId),
  index("idx_order_items_restaurant_branch_status").on(table.restaurantId, table.branchId, table.status),
]);

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  id: text("id").primaryKey(),
  restaurantId: text("restaurant_id").notNull().references(() => restaurants.id),
  actorId: text("actor_id").notNull().references(() => users.id),
  key: text("key").notNull(),
  responseJson: text("response_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("uq_idempotency_actor_key").on(table.restaurantId, table.actorId, table.key)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  restaurantId: text("restaurant_id").notNull(),
  branchId: text("branch_id"),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  result: text("result").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_audit_restaurant_created").on(table.restaurantId, table.createdAt)]);
