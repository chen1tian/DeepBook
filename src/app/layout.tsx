import type { Metadata } from "next";
import "./globals.css";
import LayoutClient from "@/components/LayoutClient";

export const metadata: Metadata = {
  title: "DeepBook",
  description: "AI 驱动的小说创作与角色扮演平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body className="min-h-dvh bg-zinc-950 text-zinc-200 antialiased">
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
