import migrationSql from "../drizzle/0000_cloudy_squirrel_girl.sql?raw";
import concurrencyMigrationSql from "../drizzle/0001_curved_speed.sql?raw";
import { getD1 } from ".";

let ready: Promise<void> | undefined;

export function ensureDatabase() {
  ready ??= bootstrap();
  return ready;
}

async function bootstrap() {
  const d1 = getD1();
  const exists = await d1.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'restaurants'").first();
  if (!exists) {
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => d1.prepare(statement));
    await d1.batch(statements);
  }

  const concurrencyIndex = await d1.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'uq_orders_open_table'").first();
  if (!concurrencyIndex) await d1.prepare(concurrencyMigrationSql.trim()).run();

  const seeded = await d1.prepare("SELECT id FROM restaurants WHERE id = ? LIMIT 1").bind("rest-narenj").first();
  if (!seeded) await seedDemo(d1);
  await d1.prepare("PRAGMA optimize").run();
}

async function seedDemo(d1: D1Database) {
  const statements = [
    d1.prepare("INSERT INTO restaurants (id, name, slug) VALUES (?, ?, ?)").bind("rest-narenj", "کافه رستوران نارنج", "narenj"),
    d1.prepare("INSERT INTO restaurants (id, name, slug) VALUES (?, ?, ?)").bind("rest-sadaf", "رستوران صدف", "sadaf"),
    d1.prepare("INSERT INTO branches (id, restaurant_id, name) VALUES (?, ?, ?)").bind("branch-vanak", "rest-narenj", "شعبه ونک"),
    d1.prepare("INSERT INTO branches (id, restaurant_id, name) VALUES (?, ?, ?)").bind("branch-yousefabad", "rest-narenj", "شعبه یوسف‌آباد"),
    d1.prepare("INSERT INTO branches (id, restaurant_id, name) VALUES (?, ?, ?)").bind("branch-sadaf", "rest-sadaf", "شعبه مرکزی"),
    d1.prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)").bind("user-manager", "manager@narenj.demo", "آرمان احمدی", "b9a9c0814e9d1a10eff04665d00546f83e2514499c7a43b5cc59d663878291f7"),
    d1.prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)").bind("user-waiter", "waiter@narenj.demo", "مریم رضایی", "ff5e5db1bb52183fac9db72f4c96bb7edff976bc415b526a0702604592eba3d6"),
    d1.prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)").bind("user-kitchen", "kitchen@narenj.demo", "رضا کریمی", "dd8e2effdb9b637687220b3a08907835af566a1559fd151e9640f551bcba1589"),
    d1.prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)").bind("user-other", "manager@sadaf.demo", "سارا صادقی", "d549660c55fd90406ed4352fba9e99a6fb2de29a231417e69b81931eb44e2c42"),
    d1.prepare("INSERT INTO memberships (id, user_id, restaurant_id, branch_id, role) VALUES (?, ?, ?, ?, ?)").bind("membership-manager", "user-manager", "rest-narenj", "branch-vanak", "manager"),
    d1.prepare("INSERT INTO memberships (id, user_id, restaurant_id, branch_id, role) VALUES (?, ?, ?, ?, ?)").bind("membership-waiter", "user-waiter", "rest-narenj", "branch-vanak", "waiter"),
    d1.prepare("INSERT INTO memberships (id, user_id, restaurant_id, branch_id, role) VALUES (?, ?, ?, ?, ?)").bind("membership-kitchen", "user-kitchen", "rest-narenj", "branch-vanak", "kitchen"),
    d1.prepare("INSERT INTO memberships (id, user_id, restaurant_id, branch_id, role) VALUES (?, ?, ?, ?, ?)").bind("membership-other", "user-other", "rest-sadaf", "branch-sadaf", "manager"),
    d1.prepare("INSERT INTO menu_categories (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)").bind("category-main", "rest-narenj", "غذای اصلی", 1),
    d1.prepare("INSERT INTO menu_categories (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)").bind("category-starter", "rest-narenj", "پیش‌غذا", 2),
    d1.prepare("INSERT INTO menu_categories (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)").bind("category-drink", "rest-narenj", "نوشیدنی", 3),
    d1.prepare("INSERT INTO menu_categories (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)").bind("category-other", "rest-sadaf", "غذای اصلی", 1),
    d1.prepare("INSERT INTO menu_items (id, restaurant_id, branch_id, category_id, name, description, price_rials, available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind("menu-koobideh", "rest-narenj", "branch-vanak", "category-main", "کباب کوبیده مخصوص", "دو سیخ با برنج ایرانی و گوجه", 4_850_000, 1),
    d1.prepare("INSERT INTO menu_items (id, restaurant_id, branch_id, category_id, name, description, price_rials, available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind("menu-joojeh", "rest-narenj", "branch-vanak", "category-main", "جوجه کباب زعفرانی", "با برنج ایرانی و کره", 4_250_000, 1),
    d1.prepare("INSERT INTO menu_items (id, restaurant_id, branch_id, category_id, name, description, price_rials, available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind("menu-ghormeh", "rest-narenj", "branch-vanak", "category-main", "قرمه‌سبزی", "خورشت روز با برنج ایرانی", 3_650_000, 1),
    d1.prepare("INSERT INTO menu_items (id, restaurant_id, branch_id, category_id, name, description, price_rials, available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind("menu-mirza", "rest-narenj", "branch-vanak", "category-starter", "میرزاقاسمی", "بادمجان دودی، تخم‌مرغ و سیر", 1_980_000, 1),
    d1.prepare("INSERT INTO menu_items (id, restaurant_id, branch_id, category_id, name, description, price_rials, available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind("menu-salad", "rest-narenj", "branch-vanak", "category-starter", "سالاد فصل", "سس مخصوص نارنج", 1_450_000, 1),
    d1.prepare("INSERT INTO menu_items (id, restaurant_id, branch_id, category_id, name, description, price_rials, available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind("menu-doogh", "rest-narenj", "branch-vanak", "category-drink", "دوغ محلی", "بطری ۳۳۰ میلی‌لیتر", 720_000, 1),
    d1.prepare("INSERT INTO menu_items (id, restaurant_id, branch_id, category_id, name, description, price_rials, available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind("menu-sharbat", "rest-narenj", "branch-vanak", "category-drink", "شربت بهارنارنج", "با تخم شربتی", 890_000, 0),
    d1.prepare("INSERT INTO menu_items (id, restaurant_id, branch_id, category_id, name, description, price_rials, available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind("menu-other", "rest-sadaf", "branch-sadaf", "category-other", "ماهی سفید", "داده محرمانه مستأجر دوم", 9_900_000, 1),
  ];

  for (let number = 1; number <= 12; number += 1) {
    statements.push(d1.prepare("INSERT INTO dining_tables (id, restaurant_id, branch_id, number, seats) VALUES (?, ?, ?, ?, ?)").bind(`table-${number}`, "rest-narenj", "branch-vanak", number, number === 8 ? 8 : number === 5 ? 6 : number % 3 === 1 ? 2 : 4));
  }
  statements.push(d1.prepare("INSERT INTO dining_tables (id, restaurant_id, branch_id, number, seats) VALUES (?, ?, ?, ?, ?)").bind("table-other-1", "rest-sadaf", "branch-sadaf", 1, 4));

  statements.push(
    d1.prepare("INSERT INTO orders (id, restaurant_id, branch_id, table_id, status, opened_by, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind("order-12", "rest-narenj", "branch-vanak", "table-12", "open", "user-waiter", "2026-08-18T16:44:00.000Z"),
    d1.prepare("INSERT INTO orders (id, restaurant_id, branch_id, table_id, status, opened_by, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind("order-5", "rest-narenj", "branch-vanak", "table-5", "open", "user-waiter", "2026-08-18T16:35:00.000Z"),
    d1.prepare("INSERT INTO orders (id, restaurant_id, branch_id, table_id, status, opened_by, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind("order-3", "rest-narenj", "branch-vanak", "table-3", "open", "user-waiter", "2026-08-18T16:51:00.000Z"),
    d1.prepare("INSERT INTO orders (id, restaurant_id, branch_id, table_id, status, opened_by, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind("order-other", "rest-sadaf", "branch-sadaf", "table-other-1", "open", "user-other", "2026-08-18T16:45:00.000Z"),
    d1.prepare("INSERT INTO order_items (id, restaurant_id, branch_id, order_id, menu_item_id, item_name, unit_price_rials, quantity, note, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("item-12-koobideh", "rest-narenj", "branch-vanak", "order-12", "menu-koobideh", "کباب کوبیده مخصوص", 4_850_000, 2, "یک عدد بدون گوجه", "ready", "user-waiter", "2026-08-18T16:45:00.000Z", "2026-08-18T17:02:00.000Z"),
    d1.prepare("INSERT INTO order_items (id, restaurant_id, branch_id, order_id, menu_item_id, item_name, unit_price_rials, quantity, note, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("item-12-salad", "rest-narenj", "branch-vanak", "order-12", "menu-salad", "سالاد فصل", 1_450_000, 1, "سس جداگانه", "ready", "user-waiter", "2026-08-18T16:45:20.000Z", "2026-08-18T16:55:00.000Z"),
    d1.prepare("INSERT INTO order_items (id, restaurant_id, branch_id, order_id, menu_item_id, item_name, unit_price_rials, quantity, note, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("item-12-doogh", "rest-narenj", "branch-vanak", "order-12", "menu-doogh", "دوغ محلی", 720_000, 1, "", "served", "user-waiter", "2026-08-18T16:45:30.000Z", "2026-08-18T16:47:00.000Z"),
    d1.prepare("INSERT INTO order_items (id, restaurant_id, branch_id, order_id, menu_item_id, item_name, unit_price_rials, quantity, note, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("item-5-joojeh", "rest-narenj", "branch-vanak", "order-5", "menu-joojeh", "جوجه کباب زعفرانی", 4_250_000, 2, "یک پرس بدون برنج", "preparing", "user-waiter", "2026-08-18T16:36:00.000Z", "2026-08-18T16:40:00.000Z"),
    d1.prepare("INSERT INTO order_items (id, restaurant_id, branch_id, order_id, menu_item_id, item_name, unit_price_rials, quantity, note, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("item-3-ghormeh", "rest-narenj", "branch-vanak", "order-3", "menu-ghormeh", "قرمه‌سبزی", 3_650_000, 3, "یک پرس کم‌برنج", "new", "user-waiter", "2026-08-18T16:52:00.000Z", "2026-08-18T16:52:00.000Z"),
    d1.prepare("INSERT INTO order_items (id, restaurant_id, branch_id, order_id, menu_item_id, item_name, unit_price_rials, quantity, note, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("item-other", "rest-sadaf", "branch-sadaf", "order-other", "menu-other", "ماهی سفید", 9_900_000, 1, "", "new", "user-other", "2026-08-18T16:46:00.000Z", "2026-08-18T16:46:00.000Z")
  );

  await d1.batch(statements);
}
