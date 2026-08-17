import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "نارنج | مدیریت سرویس رستوران";
  const description = "هماهنگی سفارش‌های سالن و آشپزخانه برای رستوران‌های ایران";
  return {
    metadataBase: new URL(origin),
    title: { default: title, template: "%s | نارنج" },
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, type: "website", locale: "fa_IR", images: [{ url: new URL("/og.png", origin).toString(), width: 1200, height: 630, alt: "نارنج — سالن و آشپزخانه، در یک جریان" }] },
    twitter: { card: "summary_large_image", title, description, images: [new URL("/og.png", origin).toString()] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
