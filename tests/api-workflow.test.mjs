import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.NARENJ_TEST_BASE_URL ?? "http://localhost:3000";

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie, "login should return an HttpOnly session cookie");
  return cookie;
}

async function api(path, cookie, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers, cookie },
  });
  const body = await response.json();
  return { response, body };
}

test("served items stay in the customer visit until the waiter releases the table", async () => {
  const waiterCookie = await login("waiter@narenj.demo", "Waiter123!");
  const initial = await api("/api/app", waiterCookie);
  assert.equal(initial.response.status, 200);
  assert.equal(initial.body.actor.restaurantId, "rest-narenj");
  assert.ok(initial.body.menu.every((item) => item.id !== "menu-other"), "Restaurant B menu must not leak into Restaurant A");
  const initiallyOpenTables = new Set(initial.body.orders.map((order) => order.tableId));
  const reusableTable = initial.body.tables.find((table) => !initiallyOpenTables.has(table.id) && table.id !== "table-6" && table.id !== "table-7");
  assert.ok(reusableTable, "workflow needs one initially free table");

  const concurrentCommands = ["menu-doogh", "menu-salad"].map((menuItemId) => ({
    action: "add_item", tableId: "table-7", menuItemId, quantity: 1, note: "", idempotencyKey: crypto.randomUUID(),
  }));
  const concurrent = await Promise.all(concurrentCommands.map((body) => api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify(body) })));
  assert.ok(concurrent.every(({ response }) => response.status === 200), "simultaneous additions must both succeed");
  assert.equal(concurrent[0].body.item.orderId, concurrent[1].body.item.orderId, "first additions must converge on one open table order");
  assert.notEqual(concurrent[0].body.item.id, concurrent[1].body.item.id, "separate additions must both be retained");

  const unknownField = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify({ ...concurrentCommands[0], idempotencyKey: crypto.randomUUID(), restaurantId: "rest-sadaf" }) });
  assert.equal(unknownField.response.status, 400, "unexpected authority fields must be rejected at the boundary");

  const idempotencyKey = crypto.randomUUID();
  const command = { action: "add_item", tableId: "table-6", menuItemId: "menu-mirza", quantity: 2, note: "یکی کم‌سیر", idempotencyKey };
  const added = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify(command) });
  assert.equal(added.response.status, 200);
  assert.equal(added.body.item.status, "new");

  const retried = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify(command) });
  assert.equal(retried.response.status, 200);
  assert.equal(retried.body.item.id, added.body.item.id, "retry must not create a duplicate item");

  const crossTenant = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify({ ...command, idempotencyKey: crypto.randomUUID(), menuItemId: "menu-other" }) });
  assert.equal(crossTenant.response.status, 404, "known Restaurant B id must fail closed");

  const waiterTransition = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify({ action: "transition_item", itemId: added.body.item.id, toStatus: "preparing", version: 1 }) });
  assert.equal(waiterTransition.response.status, 404, "waiter must not perform kitchen work");

  const kitchenCookie = await login("kitchen@narenj.demo", "Kitchen123!");
  const preparing = await api("/api/app", kitchenCookie, { method: "POST", body: JSON.stringify({ action: "transition_item", itemId: added.body.item.id, toStatus: "preparing", version: 1 }) });
  assert.equal(preparing.response.status, 200);
  assert.equal(preparing.body.item.version, 2);

  const ready = await api("/api/app", kitchenCookie, { method: "POST", body: JSON.stringify({ action: "transition_item", itemId: added.body.item.id, toStatus: "ready", version: 2 }) });
  assert.equal(ready.response.status, 200);
  assert.equal(ready.body.item.status, "ready");

  const stale = await api("/api/app", kitchenCookie, { method: "POST", body: JSON.stringify({ action: "transition_item", itemId: added.body.item.id, toStatus: "ready", version: 2 }) });
  assert.equal(stale.response.status, 409, "invalid or stale transition must be explicit");

  const kitchenServe = await api("/api/app", kitchenCookie, { method: "POST", body: JSON.stringify({ action: "transition_item", itemId: added.body.item.id, toStatus: "served", version: 3 }) });
  assert.equal(kitchenServe.response.status, 404, "kitchen must not confirm dining-room delivery");

  const waiterServe = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify({ action: "transition_item", itemId: added.body.item.id, toStatus: "served", version: 3 }) });
  assert.equal(waiterServe.response.status, 200);
  assert.equal(waiterServe.body.item.status, "served");

  async function prepareAndServe(item) {
    const preparingItem = await api("/api/app", kitchenCookie, { method: "POST", body: JSON.stringify({ action: "transition_item", itemId: item.id, toStatus: "preparing", version: 1 }) });
    assert.equal(preparingItem.response.status, 200);
    const readyItem = await api("/api/app", kitchenCookie, { method: "POST", body: JSON.stringify({ action: "transition_item", itemId: item.id, toStatus: "ready", version: 2 }) });
    assert.equal(readyItem.response.status, 200);
    const servedItem = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify({ action: "transition_item", itemId: item.id, toStatus: "served", version: 3 }) });
    assert.equal(servedItem.response.status, 200);
  }

  const firstItem = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify({ action: "add_item", tableId: reusableTable.id, menuItemId: "menu-doogh", quantity: 1, note: "", idempotencyKey: crypto.randomUUID() }) });
  assert.equal(firstItem.response.status, 200);
  await prepareAndServe(firstItem.body.item);

  const afterFirstService = await api("/api/app", waiterCookie);
  const openVisit = afterFirstService.body.orders.find((order) => order.id === firstItem.body.item.orderId);
  assert.ok(openVisit, "serving all current items must not end a customer visit");

  const secondItem = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify({ action: "add_item", tableId: reusableTable.id, menuItemId: "menu-salad", quantity: 1, note: "", idempotencyKey: crypto.randomUUID() }) });
  assert.equal(secondItem.response.status, 200);
  assert.equal(secondItem.body.item.orderId, openVisit.id, "a later request from the same customer must append to the same order");

  const prematureClose = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify({ action: "close_order", orderId: openVisit.id, version: openVisit.version }) });
  assert.equal(prematureClose.response.status, 409, "a table with an active item must not be released");
  await prepareAndServe(secondItem.body.item);

  const kitchenClose = await api("/api/app", kitchenCookie, { method: "POST", body: JSON.stringify({ action: "close_order", orderId: openVisit.id, version: openVisit.version }) });
  assert.equal(kitchenClose.response.status, 404, "kitchen must not end a dining-room visit");
  const closedVisit = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify({ action: "close_order", orderId: openVisit.id, version: openVisit.version }) });
  assert.equal(closedVisit.response.status, 200);

  const afterClose = await api("/api/app", waiterCookie);
  assert.ok(!afterClose.body.orders.some((order) => order.id === openVisit.id), "explicit end of service must release the table");

  const nextCustomerItem = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify({ action: "add_item", tableId: reusableTable.id, menuItemId: "menu-doogh", quantity: 1, note: "", idempotencyKey: crypto.randomUUID() }) });
  assert.equal(nextCustomerItem.response.status, 200);
  assert.notEqual(nextCustomerItem.body.item.orderId, openVisit.id, "the next customer must receive a new order");
  await prepareAndServe(nextCustomerItem.body.item);
  const nextVisit = (await api("/api/app", waiterCookie)).body.orders.find((order) => order.id === nextCustomerItem.body.item.orderId);
  assert.ok(nextVisit);
  const nextClosed = await api("/api/app", waiterCookie, { method: "POST", body: JSON.stringify({ action: "close_order", orderId: nextVisit.id, version: nextVisit.version }) });
  assert.equal(nextClosed.response.status, 200);

  const managerCookie = await login("manager@narenj.demo", "Manager123!");
  const handover = await api("/api/shift-summary", managerCookie, { method: "POST" });
  assert.equal(handover.response.status, 200);
  assert.ok(Array.isArray(handover.body.metrics.categoryLeaders));
  assert.ok(handover.body.metrics.categoryLeaders.length >= 3, "seeded sales should produce a leader for each Narenj category");
  assert.equal(new Set(handover.body.metrics.categoryLeaders.map((leader) => leader.category)).size, handover.body.metrics.categoryLeaders.length, "each category must appear once");
  assert.equal("topItem" in handover.body.metrics, false, "the summary must not expose a misleading overall bestseller");
  for (const leader of handover.body.metrics.categoryLeaders) {
    assert.ok(leader.quantity > 0 && leader.items.length > 0);
    assert.ok(handover.body.summary.summary.includes(leader.category), `summary must mention ${leader.category}`);
    assert.ok(leader.items.every((name) => handover.body.summary.summary.includes(name)), `summary must preserve leaders and ties for ${leader.category}`);
    assert.ok(leader.items.every((name) => name !== "ماهی سفید"), "Restaurant B sales must not leak into Restaurant A summary");
  }
});
