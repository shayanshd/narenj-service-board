"use client";

import { useCallback, useEffect, useState } from "react";

type Role = "manager" | "waiter" | "kitchen";
type View = "floor" | "kitchen" | "menu" | "shift";
type Status = "new" | "preparing" | "ready" | "served" | "cancelled";
type Actor = { userId: string; restaurantId: string; branchId: string; role: Role; name: string; email: string };
type DiningTable = { id: string; number: number; seats: number; area: string };
type MenuItem = { id: string; name: string; description: string; priceRials: number; available: number | boolean; version: number; category: string };
type Order = { id: string; tableId: string; status: string; openedAt: string; version: number };
type OrderItem = { id: string; orderId: string; menuItemId: string; itemName: string; unitPriceRials: number; quantity: number; note: string; status: Status; version: number; createdAt: string; updatedAt: string };
type CategoryLeader = { category: string; items: string[]; quantity: number };
type Dashboard = { actor: Actor; restaurant: { id: string; name: string }; branch: { id: string; name: string }; tables: DiningTable[]; menu: MenuItem[]; orders: Order[]; items: OrderItem[] };

const accounts = [
  { role: "waiter" as Role, label: "گارسون", name: "مریم رضایی", email: "waiter@narenj.demo", password: "Waiter123!", detail: "ثبت سفارش میز" },
  { role: "kitchen" as Role, label: "آشپزخانه", name: "رضا کریمی", email: "kitchen@narenj.demo", password: "Kitchen123!", detail: "آماده‌سازی سفارش" },
  { role: "manager" as Role, label: "مدیر", name: "آرمان احمدی", email: "manager@narenj.demo", password: "Manager123!", detail: "منو و گزارش شیفت" },
];

const roleLabel: Record<Role, string> = { manager: "مدیر", waiter: "گارسون", kitchen: "آشپزخانه" };
const statusLabel: Record<Status, string> = { new: "جدید", preparing: "در حال آماده‌سازی", ready: "آماده سرو", served: "سرو شده", cancelled: "لغو شده" };
const fa = new Intl.NumberFormat("fa-IR");
const toman = (rials: number) => `${fa.format(rials / 10)} تومان`;
const faTime = (value: string) => new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export default function NarenjApp() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("floor");
  const [selectedTableId, setSelectedTableId] = useState("table-12");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draftItemId, setDraftItemId] = useState("");
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [draftNote, setDraftNote] = useState("");
  const signedIn = data !== null;

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/app", { cache: "no-store" });
      if (response.status === 401) { setData(null); return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "دریافت اطلاعات ناموفق بود.");
      setData(body);
      setView((current) => current === "floor" && body.actor.role === "kitchen" ? "kitchen" : current);
    } catch (error) {
      setToast({ kind: "error", text: error instanceof Error ? error.message : "خطای ارتباط" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  useEffect(() => {
    if (!signedIn) return;
    const interval = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(interval);
  }, [signedIn, load]);

  async function login(email: string, password: string) {
    setBusy(email); setLoginError("");
    try {
      const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "ورود ناموفق بود.");
      await load();
    } catch (error) { setLoginError(error instanceof Error ? error.message : "ورود ناموفق بود."); }
    finally { setBusy(""); }
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setData(null); setView("floor");
  }

  async function mutate(payload: Record<string, unknown>, success: string) {
    setBusy(String(payload.action));
    try {
      const response = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "عملیات ناموفق بود.");
      setToast({ kind: "ok", text: success });
      await load();
      return true;
    } catch (error) {
      setToast({ kind: "error", text: error instanceof Error ? error.message : "عملیات ناموفق بود." });
      return false;
    } finally { setBusy(""); }
  }

  if (loading) return <LoadingScreen />;
  if (!data) return <LoginScreen onLogin={login} busy={busy} error={loginError} />;

  const activeItems = data.items.filter((item) => item.status !== "cancelled");
  const kitchenCount = activeItems.filter((item) => item.status === "new" || item.status === "preparing").length;

  return (
    <main className="app-shell" dir="rtl">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">ن</span><span><strong>نارنج</strong><small>مدیریت سرویس</small></span></div>
        <nav className="nav-list" aria-label="بخش‌های برنامه">
          {(data.actor.role === "waiter" || data.actor.role === "manager") && <NavButton active={view === "floor"} icon="⌂" label="نمای سالن" count={String(data.tables.length)} onClick={() => setView("floor")} />}
          {(data.actor.role === "kitchen" || data.actor.role === "manager") && <NavButton active={view === "kitchen"} icon="◫" label="آشپزخانه" count={String(kitchenCount)} urgent onClick={() => setView("kitchen")} />}
          {data.actor.role === "manager" && <NavButton active={view === "menu"} icon="≡" label="منو و موجودی" onClick={() => setView("menu")} />}
          {data.actor.role === "manager" && <NavButton active={view === "shift"} icon="↗" label="خلاصه شیفت" onClick={() => setView("shift")} />}
        </nav>
        <div className="sidebar-note"><span className="live-dot" />متصل و همگام<small>تازه‌سازی خودکار هر ۱۵ ثانیه</small></div>
        <div className="profile-card"><span className="avatar">{data.actor.name.slice(0, 2)}</span><span><strong>{data.actor.name}</strong><small>{roleLabel[data.actor.role]} · {data.branch.name}</small></span><button aria-label="خروج" title="خروج" onClick={logout}>↪</button></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">سه‌شنبه، ۲۷ مرداد · شیفت عصر</p><h1>{viewTitle(view)}</h1></div>
          <div className="top-actions"><span className="role-pill">{roleLabel[data.actor.role]}</span><span className="branch-pill">{data.branch.name}</span><button className="refresh-button" aria-label="تازه‌سازی" onClick={() => void load()}>↻</button></div>
        </header>

        {view === "floor" && <FloorView data={data} selectedTableId={selectedTableId} busy={busy} onSelect={setSelectedTableId} onAdd={() => setAddOpen(true)} onServe={(item) => void mutate({ action: "transition_item", itemId: item.id, toStatus: "served", version: item.version }, `«${item.itemName}» تحویل شد؛ سفارش میز برای درخواست‌های بعدی باز است.`)} onCloseOrder={(order) => void mutate({ action: "close_order", orderId: order.id, version: order.version }, "سرویس این مشتری پایان یافت و میز برای مشتری بعدی آزاد شد.")} />}
        {view === "kitchen" && <KitchenView data={data} busy={busy} onTransition={(item, toStatus) => void mutate({ action: "transition_item", itemId: item.id, toStatus, version: item.version }, `«${item.itemName}» بروزرسانی شد.`)} />}
        {view === "menu" && <MenuView data={data} busy={busy} onToggle={(item) => void mutate({ action: "set_availability", menuItemId: item.id, available: !item.available, version: item.version }, `وضعیت «${item.name}» تغییر کرد.`)} />}
        {view === "shift" && <ShiftView data={data} />}
      </section>

      {addOpen && <AddItemDialog menu={data.menu} busy={busy} itemId={draftItemId} quantity={draftQuantity} note={draftNote} onItem={setDraftItemId} onQuantity={setDraftQuantity} onNote={setDraftNote} onClose={() => setAddOpen(false)} onSubmit={async () => {
        if (!draftItemId) { setToast({ kind: "error", text: "یک قلم از منو انتخاب کنید." }); return; }
        const ok = await mutate({ action: "add_item", tableId: selectedTableId, menuItemId: draftItemId, quantity: draftQuantity, note: draftNote, idempotencyKey: crypto.randomUUID() }, "قلم جدید با موفقیت به آشپزخانه فرستاده شد.");
        if (ok) { setAddOpen(false); setDraftItemId(""); setDraftQuantity(1); setDraftNote(""); }
      }} />}
      {toast && <div className={`toast ${toast.kind}`} role="status"><span>{toast.kind === "ok" ? "✓" : "!"}</span>{toast.text}<button aria-label="بستن" onClick={() => setToast(null)}>×</button></div>}
    </main>
  );
}

function LoginScreen({ onLogin, busy, error }: { onLogin: (email: string, password: string) => void; busy: string; error: string }) {
  return <main className="login-page" dir="rtl">
    <section className="login-intro"><div className="login-brand"><span className="brand-mark">ن</span><strong>نارنج</strong></div><p className="login-kicker">سرویس روان، بدون کاغذ و پیام گمشده</p><h1>سالن و آشپزخانه،<br /><em>در یک جریان.</em></h1><p className="login-copy">برای بررسی محصول، با یکی از نقش‌های آماده وارد شوید. هر نقش فقط ابزارهای مورد نیاز خودش را می‌بیند.</p><div className="login-proof"><span><b>۱۲</b> میز واقعی</span><span><b>۳</b> نقش مستقل</span><span><b>۲</b> رستوران جدا</span></div></section>
    <section className="login-panel"><div className="login-heading"><span>نسخه ارزیابی</span><h2>انتخاب نقش نمایشی</h2><p>اطلاعات ورود زیر از قبل آماده شده است.</p></div><div className="account-list">{accounts.map((account) => <article className="account-card" key={account.role}><div className={`account-icon ${account.role}`}>{account.name.slice(0, 2)}</div><div><strong>{account.label}</strong><p>{account.name} · {account.detail}</p><code>{account.email}</code><code>{account.password}</code></div><button disabled={Boolean(busy)} onClick={() => onLogin(account.email, account.password)}>{busy === account.email ? "در حال ورود…" : "ورود"}</button></article>)}</div>{error && <p className="form-error">{error}</p>}<p className="login-security">نشست‌ها در کوکی HttpOnly نگهداری می‌شوند؛ نقش و رستوران از سمت سرور تعیین می‌شود.</p></section>
  </main>;
}

function LoadingScreen() { return <main className="loading-page" dir="rtl"><span className="brand-mark">ن</span><p>در حال آماده‌سازی شیفت…</p></main>; }

function NavButton({ active, icon, label, count, urgent, onClick }: { active: boolean; icon: string; label: string; count?: string; urgent?: boolean; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><span className="nav-icon">{icon}</span>{label}{count && <span className={`nav-count ${urgent ? "urgent" : ""}`}>{fa.format(Number(count))}</span>}</button>;
}

function FloorView({ data, selectedTableId, busy, onSelect, onAdd, onServe, onCloseOrder }: { data: Dashboard; selectedTableId: string; busy: string; onSelect: (id: string) => void; onAdd: () => void; onServe: (item: OrderItem) => void; onCloseOrder: (order: Order) => void }) {
  const openByTable = new Map(data.orders.map((order) => [order.tableId, order]));
  const selectedTable = data.tables.find((table) => table.id === selectedTableId) ?? data.tables[0];
  const selectedOrder = openByTable.get(selectedTable.id);
  const selectedItems = selectedOrder ? data.items.filter((item) => item.orderId === selectedOrder.id) : [];
  const readyTables = data.tables.filter((table) => { const order = openByTable.get(table.id); return order && data.items.some((item) => item.orderId === order.id && item.status === "ready"); }).length;
  const kitchenTables = data.tables.filter((table) => { const order = openByTable.get(table.id); return order && data.items.some((item) => item.orderId === order.id && (item.status === "new" || item.status === "preparing")); }).length;
  return <>
    <div className="status-row"><div><b>{fa.format(data.tables.length)}</b><span>میز سالن</span></div><div><b className="orange-text">{fa.format(kitchenTables)}</b><span>در آشپزخانه</span></div><div><b className="green-text">{fa.format(readyTables)}</b><span>آماده سرو</span></div><div><b>{fa.format(data.tables.length - openByTable.size)}</b><span>میز آزاد</span></div></div>
    <div className="section-heading"><div><h2>سالن اصلی</h2><p>برای مشاهده یا ثبت سفارش، یک میز را انتخاب کنید.</p></div><div className="legend"><span><i className="dot free" /> آزاد</span><span><i className="dot kitchen" /> در آشپزخانه</span><span><i className="dot ready" /> آماده سرو</span></div></div>
    <div className="content-grid"><div className="tables-grid">{data.tables.map((table) => {
      const order = openByTable.get(table.id); const items = order ? data.items.filter((item) => item.orderId === order.id) : []; const state = table.id === selectedTable.id ? "selected" : tableState(items); const label = tableLabel(items);
      return <button className={`table-card ${state}`} key={table.id} onClick={() => onSelect(table.id)} aria-pressed={table.id === selectedTable.id}><div className="table-topline"><span className="table-number">{fa.format(table.number)}</span><span className={`state-badge ${state}`}>{label}</span></div><h3>میز {fa.format(table.number)}</h3><p>{fa.format(table.seats)} نفر</p>{order && <div className="table-meta"><span>{fa.format(items.reduce((sum, item) => sum + item.quantity, 0))} قلم</span><span>از {faTime(order.openedAt)}</span></div>}</button>;
    })}</div><OrderPanel table={selectedTable} order={selectedOrder} items={selectedItems} busy={busy} onAdd={onAdd} onServe={onServe} onCloseOrder={onCloseOrder} /></div>
  </>;
}

function OrderPanel({ table, order, items, busy, onAdd, onServe, onCloseOrder }: { table: DiningTable; order?: Order; items: OrderItem[]; busy: string; onAdd: () => void; onServe: (item: OrderItem) => void; onCloseOrder: (order: Order) => void }) {
  const canClose = Boolean(order) && items.every((item) => item.status === "served" || item.status === "cancelled");
  return <aside className="order-panel"><div className="panel-heading"><div><span className="selected-kicker">انتخاب شده</span><h2>میز {fa.format(table.number)}</h2><p>{fa.format(table.seats)} نفر {order ? `· باز شده ساعت ${faTime(order.openedAt)}` : "· آماده پذیرش"}</p></div></div>
    {items.length > 0 ? <><div className="progress-track"><span className="done">ثبت</span><i /><span className={items.some((item) => item.status === "preparing" || item.status === "ready" || item.status === "served") ? "done" : "current"}>آماده‌سازی</span><i /><span className={items.every((item) => item.status === "served") ? "done" : items.some((item) => item.status === "ready") ? "current" : ""}>سرو</span></div><div className="order-list">{items.map((item) => <article key={item.id}><span className="qty">{fa.format(item.quantity)}</span><div><strong>{item.itemName}</strong><small>{item.note || "بدون توضیح"}</small></div><div className="order-item-state"><span className={`${item.status}-label`}>{statusLabel[item.status]}</span>{item.status === "ready" && <button className="serve-item-button" disabled={Boolean(busy)} onClick={() => onServe(item)}>تحویل شد</button>}</div></article>)}</div></> : <div className="empty-order"><span>＋</span><h3>این میز هنوز سفارشی ندارد</h3><p>اولین قلم را اضافه کنید تا سفارش باز شود.</p></div>}
    <button className="primary-action" disabled={Boolean(busy)} onClick={onAdd}><span>＋</span> افزودن به سفارش</button>{canClose && order && <button className="close-service-button" disabled={Boolean(busy)} onClick={() => onCloseOrder(order)}>پایان سرویس و آزاد کردن میز</button>}<p className="safe-note"><span>✓</span> سفارش تا زمان پایان سرویس باز می‌ماند؛ اقلام بعدی به همین سفارش افزوده می‌شوند.</p></aside>;
}

function KitchenView({ data, busy, onTransition }: { data: Dashboard; busy: string; onTransition: (item: OrderItem, status: Status) => void }) {
  const tableNumber = new Map(data.tables.map((table) => [table.id, table.number]));
  const orders = data.orders.map((order) => ({ ...order, items: data.items.filter((item) => item.orderId === order.id && item.status !== "served" && item.status !== "cancelled") })).filter((order) => order.items.length > 0);
  return <section className="kitchen-view"><div className="kitchen-toolbar"><div><strong>{fa.format(orders.length)} سفارش فعال</strong><span>قدیمی‌ترین سفارش در ابتدای صف است.</span></div><div className="kitchen-legend"><span><i className="dot new" /> جدید</span><span><i className="dot kitchen" /> آماده‌سازی</span><span><i className="dot ready" /> آماده</span></div></div><div className="ticket-grid">{orders.map((order) => <article className="ticket" key={order.id}><header><div><span>میز {fa.format(tableNumber.get(order.tableId) ?? 0)}</span><small>ثبت {faTime(order.openedAt)}</small></div><b>{ageMinutes(order.openedAt)} دقیقه</b></header><div className="ticket-items">{order.items.map((item) => <div className={`ticket-item ${item.status}`} key={item.id}><span className="ticket-qty">{fa.format(item.quantity)}×</span><div><strong>{item.itemName}</strong>{item.note && <small>{item.note}</small>}</div><span className="ticket-status">{statusLabel[item.status]}</span>{item.status === "new" && <button disabled={Boolean(busy)} onClick={() => onTransition(item, "preparing")}>شروع</button>}{item.status === "preparing" && <button disabled={Boolean(busy)} onClick={() => onTransition(item, "ready")}>آماده شد</button>}{item.status === "ready" && <span className="ready-check">✓ آماده تحویل</span>}</div>)}</div></article>)}</div></section>;
}

function MenuView({ data, busy, onToggle }: { data: Dashboard; busy: string; onToggle: (item: MenuItem) => void }) {
  const categories = [...new Set(data.menu.map((item) => item.category))];
  return <section className="menu-view"><div className="manager-callout"><span>تصمیم عملیاتی</span><div><strong>تغییر موجودی بلافاصله روی سفارش‌گیری اثر می‌گذارد.</strong><p>قلم ناموجود در منوی گارسون غیرفعال می‌شود؛ سفارش‌های قبلی دست‌نخورده می‌مانند.</p></div></div>{categories.map((category) => <section className="menu-section" key={category}><div className="menu-section-title"><h2>{category}</h2><span>{fa.format(data.menu.filter((item) => item.category === category).length)} قلم</span></div><div className="menu-admin-list">{data.menu.filter((item) => item.category === category).map((item) => <article key={item.id} className={!item.available ? "unavailable" : ""}><div><strong>{item.name}</strong><p>{item.description}</p></div><b>{toman(item.priceRials)}</b><label className="availability-switch"><input type="checkbox" checked={Boolean(item.available)} disabled={Boolean(busy)} onChange={() => onToggle(item)} /><span /><em>{item.available ? "موجود" : "ناموجود"}</em></label></article>)}</div></section>)}</section>;
}

function ShiftView({ data }: { data: Dashboard }) {
  const [generated, setGenerated] = useState<{ source: "ai" | "fallback"; metrics: { categoryLeaders: CategoryLeader[] }; summary: { headline: string; summary: string; actions: string[] } } | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const completed = data.items.filter((item) => item.status === "ready" || item.status === "served");
  const preparationTimes = completed.map((item) => (new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime()) / 60000).filter((value) => value >= 0);
  const average = preparationTimes.length ? Math.round(preparationTimes.reduce((a, b) => a + b, 0) / preparationTimes.length) : 0;
  const revenueRials = data.items.filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + item.unitPriceRials * item.quantity, 0);
  async function generate() {
    setSummaryBusy(true); setSummaryError("");
    try {
      const response = await fetch("/api/shift-summary", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "تولید خلاصه ناموفق بود.");
      setGenerated(body);
    } catch (error) { setSummaryError(error instanceof Error ? error.message : "تولید خلاصه ناموفق بود."); }
    finally { setSummaryBusy(false); }
  }
  return <section className="shift-view"><div className="metric-grid"><article><span>سفارش‌های باز</span><b>{fa.format(data.orders.length)}</b><small>در این شعبه</small></article><article><span>میانگین آماده‌سازی</span><b>{fa.format(average)} <em>دقیقه</em></b><small>بر اساس اقلام تکمیل‌شده</small></article><article><span>فروش جاری</span><b>{toman(revenueRials)}</b><small>عملیاتی، نه حسابداری</small></article><article><span>اقلام ناموجود</span><b>{fa.format(data.menu.filter((item) => !item.available).length)}</b><small>نیازمند بررسی مدیر</small></article></div><div className="summary-card"><div className="summary-badge">AI</div><div className="summary-heading"><span>دستیار تحویل شیفت</span><h2>خلاصه قابل اقدام، بدون دخالت در سرویس</h2><p>مدل فقط آمار تجمیعی همین شعبه را دریافت می‌کند. سفارش، قیمت یا وضعیت هیچ قلمی را تغییر نمی‌دهد.</p></div>{generated ? <div className="generated-summary"><div className="summary-source">{generated.source === "ai" ? "تولیدشده با AI" : "نسخه قطعی جایگزین"}</div><h3>{generated.summary.headline}</h3><p>{generated.summary.summary}</p>{generated.metrics.categoryLeaders.length > 0 && <div className="category-leader-grid">{generated.metrics.categoryLeaders.map((leader) => <article key={leader.category}><span>{leader.category}</span><strong>{leader.items.join("، ")}</strong><small>{fa.format(leader.quantity)} عدد ثبت‌شده</small></article>)}</div>}<ul>{generated.summary.actions.map((action) => <li key={action}>{action}</li>)}</ul></div> : <div className="summary-placeholder"><span>آماده تولید</span><p>اگر ارائه‌دهنده در دسترس نباشد، یک خلاصه قطعی از همین شاخص‌ها نمایش داده می‌شود؛ سرویس رستوران متوقف نخواهد شد.</p></div>}{summaryError && <p className="form-error">{summaryError}</p>}<button className="secondary-action enabled" disabled={summaryBusy} onClick={() => void generate()}>{summaryBusy ? "در حال تولید…" : generated ? "تولید دوباره" : "تولید خلاصه شیفت"}</button></div></section>;
}

function AddItemDialog({ menu, busy, itemId, quantity, note, onItem, onQuantity, onNote, onClose, onSubmit }: { menu: MenuItem[]; busy: string; itemId: string; quantity: number; note: string; onItem: (id: string) => void; onQuantity: (value: number) => void; onNote: (value: string) => void; onClose: () => void; onSubmit: () => void }) {
  const selected = menu.find((item) => item.id === itemId);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-title"><header><div><span>سفارش جدید</span><h2 id="add-title">افزودن قلم به آشپزخانه</h2></div><button aria-label="بستن" onClick={onClose}>×</button></header><div className="menu-picker">{menu.map((item) => <button key={item.id} disabled={!item.available} className={itemId === item.id ? "selected" : ""} onClick={() => onItem(item.id)}><div><strong>{item.name}</strong><small>{item.available ? item.category : "ناموجود"}</small></div><b>{toman(item.priceRials)}</b></button>)}</div><div className="draft-controls"><div className="quantity-field"><span>تعداد</span><div className="stepper"><button aria-label="کاهش تعداد" onClick={() => onQuantity(Math.max(1, quantity - 1))}>−</button><span>{fa.format(quantity)}</span><button aria-label="افزایش تعداد" onClick={() => onQuantity(Math.min(20, quantity + 1))}>＋</button></div></div><label className="note-field">توضیح برای آشپزخانه<input value={note} maxLength={160} placeholder="مثلاً بدون گوجه، سس جدا" onChange={(event) => onNote(event.target.value)} /><small>{fa.format(note.length)} / ۱۶۰</small></label></div><footer><div>{selected ? <><strong>{selected.name}</strong><span>{toman(selected.priceRials * quantity)}</span></> : <span>یک قلم انتخاب کنید</span>}</div><button className="primary-action" disabled={Boolean(busy) || !selected} onClick={onSubmit}>{busy ? "در حال ارسال…" : "ارسال به آشپزخانه"}</button></footer></section></div>;
}

function tableState(items: OrderItem[]) { if (!items.length) return "free"; if (items.some((item) => item.status === "ready")) return "ready"; if (items.some((item) => item.status === "new" || item.status === "preparing")) return "kitchen"; return "served"; }
function tableLabel(items: OrderItem[]) { const state = tableState(items); if (state === "ready") return `${fa.format(items.filter((item) => item.status === "ready").length)} قلم آماده`; if (state === "kitchen") return "در آشپزخانه"; if (state === "served") return "سرو شده"; return "آماده"; }
function viewTitle(view: View) { return { floor: "وضعیت سالن", kitchen: "صف آشپزخانه", menu: "منو و موجودی", shift: "خلاصه شیفت" }[view]; }
function ageMinutes(value: string) { return fa.format(Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))); }
