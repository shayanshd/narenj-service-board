export type Role = "manager" | "waiter" | "kitchen";
export type Action =
  | "view_floor"
  | "add_order_item"
  | "view_kitchen"
  | "progress_kitchen_item"
  | "serve_item"
  | "set_availability"
  | "view_shift_summary";

export type ActorContext = {
  userId: string;
  restaurantId: string;
  branchId: string;
  role: Role;
  name: string;
  email: string;
};

const permissions: Record<Role, ReadonlySet<Action>> = {
  manager: new Set(["view_floor", "add_order_item", "view_kitchen", "progress_kitchen_item", "serve_item", "set_availability", "view_shift_summary"]),
  waiter: new Set(["view_floor", "add_order_item", "serve_item"]),
  kitchen: new Set(["view_kitchen", "progress_kitchen_item"]),
};

export function can(actor: Pick<ActorContext, "role">, action: Action) {
  return permissions[actor.role].has(action);
}

export function requireAction(actor: Pick<ActorContext, "role">, action: Action) {
  if (!can(actor, action)) throw new AuthorizationError();
}

export function isInsideTenant(actor: Pick<ActorContext, "restaurantId" | "branchId">, record: { restaurantId: string; branchId?: string | null }) {
  return record.restaurantId === actor.restaurantId && (!record.branchId || record.branchId === actor.branchId);
}

export class AuthorizationError extends Error {
  readonly status = 404;
  constructor() { super("Resource not found"); }
}
