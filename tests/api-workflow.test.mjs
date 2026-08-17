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

test("complete waiter-to-kitchen workflow retains retries and tenant isolation", async () => {
  const waiterCookie = await login("waiter@narenj.demo", "Waiter123!");
  const initial = await api("/api/app", waiterCookie);
  assert.equal(initial.response.status, 200);
  assert.equal(initial.body.actor.restaurantId, "rest-narenj");
  assert.ok(initial.body.menu.every((item) => item.id !== "menu-other"), "Restaurant B menu must not leak into Restaurant A");

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
});
