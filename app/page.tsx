import type { Metadata } from "next";
import NarenjApp from "./NarenjApp";

export const metadata: Metadata = {
  title: "سالن",
  description: "هماهنگی سفارش‌های سالن و آشپزخانه کافه نارنج",
};

export default function Home() {
  return <NarenjApp />;
}
