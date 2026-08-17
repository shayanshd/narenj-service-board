import { ensureDatabase } from "../../../db/bootstrap";
import { getD1 } from "../../../db";
import { requireActor, AuthenticationError } from "../_lib/auth";
import { AuthorizationError, requireAction, type ActorContext } from "../../../domain/policy";
import { InputError, requireExactKeys, requireTransition, TransitionError, validateNewItem, type KitchenStatus } from "../../../domain/order";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  try {
    await ensureDatabase();
    const actor = await requireActor(request);
    const d1 = getD1();
    const [restaurant, branch, tables, menu, orders, items] = await Promise.all([
      d1.prepare("SELECT id, name FROM restaurants WHERE id = ? LIMIT 1").bind(actor.restaurantId).first(),
      d1.prepare("SELECT id, name FROM branches WHERE id = ? AND restaurant_id = ? LIMIT 1").bind(actor.branchId, actor.restaurantId).first(),
      d1.prepare("SELECT id, number, seats, area FROM dining_tables WHERE restaurant_id = ? AND branch_id = ? ORDER BY number").bind(actor.restaurantId, actor.branchId).all(),
      d1.prepare(`SELECT mi.id, mi.name, mi.description, mi.price_rials AS priceRials, mi.available, mi.version, mc.name AS category
        FROM menu_items mi JOIN menu_categories mc ON mc.id = mi.category_id AND mc.restaurant_id = mi.restaurant_id
        WHERE mi.restaurant_id = ? AND (mi.branch_id IS NULL OR mi.branch_id = ?)
        ORDER BY mc.sort_order, mi.name`).bind(actor.restaurantId, actor.branchId).all(),
      d1.prepare(`SELECT id, table_id AS tableId, status, opened_at AS openedAt, version
        FROM orders WHERE restaurant_id = ? AND branch_id = ? AND status = 'open' ORDER BY opened_at`).bind(actor.restaurantId, actor.branchId).all(),
      d1.prepare(`SELECT id, order_id AS orderId, menu_item_id AS menuItemId, item_name AS itemName,
          unit_price_rials AS unitPriceRials, quantity, note, status, version, created_at AS createdAt, updated_at AS updatedAt
        FROM order_items WHERE restaurant_id = ? AND branch_id = ? AND status != 'cancelled' ORDER BY created_at`).bind(actor.restaurantId, actor.branchId).all(),
    ]);
    log({ requestId, actor, action: "dashboard.read", result: "ok", durationMs: Date.now() - startedAt });
    return Response.json({ actor, restaurant, branch, tables: tables.results, menu: menu.results, orders: orders.results, items: items.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return routeError(error, requestId, startedAt); }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  try {
    await ensureDatabase();
    const actor = await requireActor(request);
    let payload: Record<string, unknown>;
    try { payload = await request.json() as Record<string, unknown>; } catch { throw new InputError("Request body must be valid JSON"); }
    const action = payload.action;
    let result: unknown;
    if (action === "add_item") result = await addItem(actor, payload, requestId);
    else if (action === "transition_item") result = await transitionItem(actor, payload, requestId);
    else if (action === "set_availability") result = await setAvailability(actor, payload, requestId);
    else throw new InputError("Unknown action");
    log({ requestId, actor, action: String(action), result: "ok", durationMs: Date.now() - startedAt });
    return Response.json(result);
  } catch (error) { return routeError(error, requestId, startedAt); }
}

async function addItem(actor: ActorContext, payload: Record<string, unknown>, requestId: string) {
  requireAction(actor, "add_order_item");
  requireExactKeys(payload, ["action", "tableId", "menuItemId", "quantity", "note", "idempotencyKey"]);
  const input = validateNewItem(payload);
  const d1 = getD1();
  const previous = await d1.prepare("SELECT response_json AS responseJson FROM idempotency_keys WHERE restaurant_id = ? AND actor_id = ? AND key = ? LIMIT 1").bind(actor.restaurantId, actor.userId, input.idempotencyKey).first<{ responseJson: string }>();
  if (previous) return JSON.parse(previous.responseJson);

  const table = await d1.prepare("SELECT id FROM dining_tables WHERE id = ? AND restaurant_id = ? AND branch_id = ? LIMIT 1").bind(input.tableId, actor.restaurantId, actor.branchId).first<{ id: string }>();
  const menuItem = await d1.prepare("SELECT id, name, price_rials AS priceRials, available FROM menu_items WHERE id = ? AND restaurant_id = ? AND (branch_id IS NULL OR branch_id = ?) LIMIT 1").bind(input.menuItemId, actor.restaurantId, actor.branchId).first<{ id: string; name: string; priceRials: number; available: number }>();
  if (!table || !menuItem) throw new AuthorizationError();
  if (!menuItem.available) throw new ConflictError("این قلم فعلاً ناموجود است.");

  let order = await d1.prepare("SELECT id FROM orders WHERE restaurant_id = ? AND branch_id = ? AND table_id = ? AND status = 'open' LIMIT 1").bind(actor.restaurantId, actor.branchId, table.id).first<{ id: string }>();
  if (!order) {
    const candidateId = crypto.randomUUID();
    await d1.prepare("INSERT OR IGNORE INTO orders (id, restaurant_id, branch_id, table_id, status, opened_by) VALUES (?, ?, ?, ?, 'open', ?)").bind(candidateId, actor.restaurantId, actor.branchId, table.id, actor.userId).run();
    order = await d1.prepare("SELECT id FROM orders WHERE restaurant_id = ? AND branch_id = ? AND table_id = ? AND status = 'open' LIMIT 1").bind(actor.restaurantId, actor.branchId, table.id).first<{ id: string }>();
  }
  if (!order) throw new ConflictError("باز کردن سفارش میز ناموفق بود. دوباره تلاش کنید.");
  const orderId = order.id;
  const itemId = crypto.randomUUID();
  const response = { item: { id: itemId, orderId, menuItemId: menuItem.id, itemName: menuItem.name, unitPriceRials: menuItem.priceRials, quantity: input.quantity, note: input.note, status: "new", version: 1, createdAt: new Date().toISOString() } };
  const statements = [];
  statements.push(
    d1.prepare("INSERT INTO order_items (id, restaurant_id, branch_id, order_id, menu_item_id, item_name, unit_price_rials, quantity, note, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)").bind(itemId, actor.restaurantId, actor.branchId, orderId, menuItem.id, menuItem.name, menuItem.priceRials, input.quantity, input.note, actor.userId),
    d1.prepare("INSERT INTO idempotency_keys (id, restaurant_id, actor_id, key, response_json) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor.restaurantId, actor.userId, input.idempotencyKey, JSON.stringify(response)),
    audit(d1, requestId, actor, "order_item.add", "order_item", itemId, "ok")
  );
  try { await d1.batch(statements); }
  catch (error) {
    const raced = await d1.prepare("SELECT response_json AS responseJson FROM idempotency_keys WHERE restaurant_id = ? AND actor_id = ? AND key = ? LIMIT 1").bind(actor.restaurantId, actor.userId, input.idempotencyKey).first<{ responseJson: string }>();
    if (raced) return JSON.parse(raced.responseJson);
    throw error;
  }
  return response;
}

async function transitionItem(actor: ActorContext, payload: Record<string, unknown>, requestId: string) {
  requireAction(actor, "transition_item");
  requireExactKeys(payload, ["action", "itemId", "toStatus", "version"]);
  const itemId = typeof payload.itemId === "string" ? payload.itemId : "";
  const toStatus = payload.toStatus;
  const version = payload.version;
  if (!itemId || !isKitchenStatus(toStatus) || !Number.isInteger(version)) throw new InputError("Invalid transition payload");
  const d1 = getD1();
  const item = await d1.prepare("SELECT id, status, version FROM order_items WHERE id = ? AND restaurant_id = ? AND branch_id = ? LIMIT 1").bind(itemId, actor.restaurantId, actor.branchId).first<{ id: string; status: KitchenStatus; version: number }>();
  if (!item) throw new AuthorizationError();
  requireTransition(item.status, toStatus);
  const update = await d1.prepare("UPDATE order_items SET status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ? AND branch_id = ? AND version = ? RETURNING version, updated_at AS updatedAt").bind(toStatus, itemId, actor.restaurantId, actor.branchId, Number(version)).first<{ version: number; updatedAt: string }>();
  if (!update) throw new ConflictError("این سفارش روی دستگاه دیگری تغییر کرده است. صفحه را تازه کنید.");
  await audit(d1, requestId, actor, "order_item.transition", "order_item", itemId, "ok").run();
  return { item: { id: itemId, status: toStatus, version: update.version, updatedAt: update.updatedAt } };
}

async function setAvailability(actor: ActorContext, payload: Record<string, unknown>, requestId: string) {
  requireAction(actor, "set_availability");
  requireExactKeys(payload, ["action", "menuItemId", "available", "version"]);
  const menuItemId = typeof payload.menuItemId === "string" ? payload.menuItemId : "";
  const available = payload.available;
  const version = payload.version;
  if (!menuItemId || typeof available !== "boolean" || !Number.isInteger(version)) throw new InputError("Invalid availability payload");
  const d1 = getD1();
  const update = await d1.prepare("UPDATE menu_items SET available = ?, version = version + 1 WHERE id = ? AND restaurant_id = ? AND (branch_id IS NULL OR branch_id = ?) AND version = ? RETURNING version").bind(available ? 1 : 0, menuItemId, actor.restaurantId, actor.branchId, Number(version)).first<{ version: number }>();
  if (!update) {
    const exists = await d1.prepare("SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ? AND (branch_id IS NULL OR branch_id = ?) LIMIT 1").bind(menuItemId, actor.restaurantId, actor.branchId).first();
    if (!exists) throw new AuthorizationError();
    throw new ConflictError("وضعیت این قلم روی دستگاه دیگری تغییر کرده است.");
  }
  await audit(d1, requestId, actor, "menu_item.availability", "menu_item", menuItemId, "ok").run();
  return { menuItem: { id: menuItemId, available, version: update.version } };
}

function audit(d1: D1Database, requestId: string, actor: ActorContext, action: string, entityType: string, entityId: string, result: string) {
  return d1.prepare("INSERT INTO audit_logs (id, request_id, restaurant_id, branch_id, actor_id, action, entity_type, entity_id, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), requestId, actor.restaurantId, actor.branchId, actor.userId, action, entityType, entityId, result);
}

function isKitchenStatus(value: unknown): value is KitchenStatus { return value === "new" || value === "preparing" || value === "ready" || value === "served" || value === "cancelled"; }

class ConflictError extends Error { readonly status = 409; }

function routeError(error: unknown, requestId: string, startedAt: number) {
  const status = error instanceof AuthenticationError || error instanceof AuthorizationError || error instanceof InputError || error instanceof TransitionError || error instanceof ConflictError ? error.status : 500;
  const message = status === 500 ? "خطای غیرمنتظره‌ای رخ داد." : error instanceof Error ? error.message : "خطا";
  log({ requestId, action: "request", result: "error", status, durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
  return Response.json({ error: message, requestId }, { status, headers: { "Cache-Control": "no-store" } });
}

function log(entry: Record<string, unknown>) {
  const safe = { timestamp: new Date().toISOString(), ...entry };
  if ("actor" in safe) {
    const actor = safe.actor as ActorContext;
    safe.actor = { userId: actor.userId, restaurantId: actor.restaurantId, branchId: actor.branchId, role: actor.role };
  }
  console.info(JSON.stringify(safe));
}
