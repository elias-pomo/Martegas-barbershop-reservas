import type { Metadata } from "next";
import { appleIcon } from "@/lib/manifest";

export const metadata: Metadata = {
  manifest: "/panel.webmanifest",
  icons: { icon: "/api/icon?size=64&text=A", apple: appleIcon("A") },
  appleWebApp: { capable: true, title: "Agenda", statusBarStyle: "black-translucent" },
  robots: { index: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
