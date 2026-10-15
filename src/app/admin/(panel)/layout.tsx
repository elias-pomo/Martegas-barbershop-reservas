import { Suspense } from "react";
import { BottomNav, BottomNavShell } from "../bottom-nav";

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      {children}
      <Suspense fallback={<BottomNavShell />}>
        <BottomNav />
      </Suspense>
    </>
  );
}
