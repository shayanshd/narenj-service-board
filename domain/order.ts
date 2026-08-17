export type KitchenStatus = "new" | "preparing" | "ready" | "served" | "cancelled";

const allowedTransitions: Record<KitchenStatus, readonly KitchenStatus[]> = {
  new: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
  served: [],
  cancelled: [],
};

export function canTransition(from: KitchenStatus, to: KitchenStatus) {
  return allowedTransitions[from].includes(to);
}

export function requireTransition(from: KitchenStatus, to: KitchenStatus) {
  if (!canTransition(from, to)) throw new TransitionError(from, to);
}

export class TransitionError extends Error {
  readonly status = 409;
  constructor(from: KitchenStatus, to: KitchenStatus) {
    super(`Cannot transition an item from ${from} to ${to}`);
  }
}

export function rialToToman(rials: number) {
  if (!Number.isSafeInteger(rials) || rials % 10 !== 0) throw new Error("Rial value must be a safe integer divisible by 10");
  return rials / 10;
}

export function validateNewItem(input: { menuItemId?: unknown; tableId?: unknown; quantity?: unknown; note?: unknown; idempotencyKey?: unknown }) {
  if (typeof input.menuItemId !== "string" || input.menuItemId.length < 1 || input.menuItemId.length > 80) throw new InputError("menuItemId is invalid");
  if (typeof input.tableId !== "string" || input.tableId.length < 1 || input.tableId.length > 80) throw new InputError("tableId is invalid");
  if (!Number.isInteger(input.quantity) || Number(input.quantity) < 1 || Number(input.quantity) > 20) throw new InputError("quantity must be between 1 and 20");
  if (typeof input.note !== "string" || input.note.length > 160) throw new InputError("note must be at most 160 characters");
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 100) throw new InputError("idempotencyKey is invalid");
  return { menuItemId: input.menuItemId, tableId: input.tableId, quantity: Number(input.quantity), note: input.note.trim(), idempotencyKey: input.idempotencyKey };
}

export function requireExactKeys(input: Record<string, unknown>, allowed: readonly string[]) {
  const extras = Object.keys(input).filter((key) => !allowed.includes(key));
  if (extras.length) throw new InputError(`Unknown field: ${extras[0]}`);
}

export class InputError extends Error {
  readonly status = 400;
}
