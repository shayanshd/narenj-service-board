import { ensureDatabase } from "../../../db/bootstrap";
import { getD1 } from "../../../db";
import { requireActor, AuthenticationError } from "../_lib/auth";
import { AuthorizationError, requireAction } from "../../../domain/policy";

type Metrics = {
  openOrders: number;
  newItems: number;
  preparingItems: number;
  readyItems: number;
  unavailableItems: number;
  averagePreparationMinutes: number;
  topItem: string;
};

type Summary = { headline: string; summary: string; actions: string[] };

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    await ensureDatabase();
    const actor = await requireActor(request);
    requireAction(actor, "view_shift_summary");
    const metrics = await getMetrics(actor.restaurantId, actor.branchId);
    const runtimeEnv = process.env as { OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
    if (!runtimeEnv.OPENAI_API_KEY) {
      return Response.json({ source: "fallback", reason: "provider_not_configured", metrics, summary: deterministicSummary(metrics) });
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${runtimeEnv.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(7_000),
        body: JSON.stringify({
          model: runtimeEnv.OPENAI_MODEL ?? "gpt-4.1-mini",
          store: false,
          max_output_tokens: 450,
          input: [
            { role: "system", content: "You write concise Persian shift handovers for a restaurant manager. Use only the provided aggregate metrics. Do not invent causes, revenue, customers, or events. Lead with the operational conclusion. Actions must be specific but framed as checks, not facts. Never issue commands that change restaurant data." },
            { role: "user", content: JSON.stringify({ branchTimezone: "Asia/Tehran", currencyDisplayUnit: "toman", metrics }) },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "restaurant_shift_handover",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  headline: { type: "string", maxLength: 100 },
                  summary: { type: "string", maxLength: 420 },
                  actions: { type: "array", minItems: 2, maxItems: 3, items: { type: "string", maxLength: 160 } },
                },
                required: ["headline", "summary", "actions"],
              },
            },
          },
        }),
      });
      if (!response.ok) throw new Error(`provider_${response.status}`);
      const body = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
      const text = body.output?.flatMap((item) => item.content ?? []).find((content) => content.type === "output_text")?.text;
      const summary = text ? validateSummary(JSON.parse(text)) : null;
      if (!summary) throw new Error("invalid_provider_output");
      console.info(JSON.stringify({ timestamp: new Date().toISOString(), requestId, actor: { userId: actor.userId, restaurantId: actor.restaurantId, branchId: actor.branchId }, action: "shift_summary.generate", result: "ai", durationMs: Date.now() - startedAt }));
      return Response.json({ source: "ai", metrics, summary });
    } catch (providerError) {
      console.warn(JSON.stringify({ timestamp: new Date().toISOString(), requestId, actor: { userId: actor.userId, restaurantId: actor.restaurantId, branchId: actor.branchId }, action: "shift_summary.generate", result: "fallback", durationMs: Date.now() - startedAt, providerError: providerError instanceof Error ? providerError.message : String(providerError) }));
      return Response.json({ source: "fallback", reason: "provider_unavailable", metrics, summary: deterministicSummary(metrics) });
    }
  } catch (error) {
    const status = error instanceof AuthenticationError || error instanceof AuthorizationError ? error.status : 500;
    return Response.json({ error: status === 500 ? "خطای غیرمنتظره‌ای رخ داد." : error instanceof Error ? error.message : "خطا", requestId }, { status });
  }
}

async function getMetrics(restaurantId: string, branchId: string): Promise<Metrics> {
  const d1 = getD1();
  const [counts, unavailable, average, top] = await Promise.all([
    d1.prepare(`SELECT
      COUNT(DISTINCT o.id) AS openOrders,
      SUM(CASE WHEN oi.status = 'new' THEN 1 ELSE 0 END) AS newItems,
      SUM(CASE WHEN oi.status = 'preparing' THEN 1 ELSE 0 END) AS preparingItems,
      SUM(CASE WHEN oi.status = 'ready' THEN 1 ELSE 0 END) AS readyItems
      FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.restaurant_id = o.restaurant_id
      WHERE o.restaurant_id = ? AND o.branch_id = ? AND o.status = 'open'`).bind(restaurantId, branchId).first<Record<string, number>>(),
    d1.prepare("SELECT COUNT(*) AS count FROM menu_items WHERE restaurant_id = ? AND (branch_id IS NULL OR branch_id = ?) AND available = 0").bind(restaurantId, branchId).first<{ count: number }>(),
    d1.prepare(`SELECT AVG((julianday(updated_at) - julianday(created_at)) * 1440.0) AS average
      FROM order_items WHERE restaurant_id = ? AND branch_id = ? AND status IN ('ready', 'served')`).bind(restaurantId, branchId).first<{ average: number | null }>(),
    d1.prepare(`SELECT item_name AS name, SUM(quantity) AS quantity FROM order_items
      WHERE restaurant_id = ? AND branch_id = ? AND status != 'cancelled'
      GROUP BY item_name ORDER BY quantity DESC, item_name LIMIT 1`).bind(restaurantId, branchId).first<{ name: string }>(),
  ]);
  return {
    openOrders: Number(counts?.openOrders ?? 0), newItems: Number(counts?.newItems ?? 0), preparingItems: Number(counts?.preparingItems ?? 0), readyItems: Number(counts?.readyItems ?? 0),
    unavailableItems: Number(unavailable?.count ?? 0), averagePreparationMinutes: Math.max(0, Math.round(Number(average?.average ?? 0))), topItem: top?.name ?? "داده کافی نیست",
  };
}

function deterministicSummary(metrics: Metrics): Summary {
  const attention = metrics.newItems + metrics.preparingItems;
  return {
    headline: attention > 0 ? `${attention} قلم هنوز در جریان آماده‌سازی است` : "صف فعال آشپزخانه خالی است",
    summary: `این شعبه ${metrics.openOrders} سفارش باز دارد. میانگین زمان اقلام تکمیل‌شده ${metrics.averagePreparationMinutes} دقیقه است و ${metrics.readyItems} قلم آماده تحویل است. پرفروش‌ترین قلم فعلی «${metrics.topItem}» بوده است.`,
    actions: [
      metrics.readyItems > 0 ? `تحویل ${metrics.readyItems} قلم آماده را با سالن بررسی کنید.` : "برای سفارش بعدی، آمادگی ایستگاه‌های آشپزخانه را بررسی کنید.",
      metrics.unavailableItems > 0 ? `وضعیت ${metrics.unavailableItems} قلم ناموجود را پیش از شیفت بعد بازبینی کنید.` : "موجودی اقلام پرتکرار را پیش از شیفت بعد کنترل کنید.",
    ],
  };
}

function validateSummary(value: unknown): Summary | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<Summary>;
  if (typeof item.headline !== "string" || item.headline.length > 100 || typeof item.summary !== "string" || item.summary.length > 420 || !Array.isArray(item.actions) || item.actions.length < 2 || item.actions.length > 3 || item.actions.some((action) => typeof action !== "string" || action.length > 160)) return null;
  return { headline: item.headline, summary: item.summary, actions: item.actions as string[] };
}
