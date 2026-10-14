import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { LiveAlerts } from "./LiveAlerts";
import { useSession } from "@/lib/useSession";

export function AppShell({
  title,
  subtitle,
  children,
  bare,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  bare?: boolean | undefined;
}) {
  const { banned } = useSession();

  if (banned) {
    return (
      <div className="app-frame bg-background">
        <div className="grid min-h-screen place-items-center px-6 text-center">
          <div>
            <p className="text-5xl">🚫</p>
            <h1 className="mt-3 text-2xl font-bold">Sei stato escluso dal gioco</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Un amministratore ha bloccato questo account. Se pensi sia un errore, contatta lo staff
              di RockDex.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-frame bg-background">
      {!bare && (
        <header className="sticky top-0 z-[800] border-b border-border bg-background/90 px-5 pb-3 pt-5 backdrop-blur">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </header>
      )}
      <main className={bare ? "" : "px-5 pt-4"}>{children}</main>
      <LiveAlerts />
      <BottomNav />
    </div>
  );
}
