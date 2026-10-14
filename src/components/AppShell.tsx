import type { ReactNode } from "react";
import { Ban } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { LiveAlerts } from "./LiveAlerts";
import { useSession } from "@/lib/useSession";

export function AppShell({
  title,
  subtitle,
  children,
  bare,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  bare?: boolean | undefined;
  /** Pulsante o elemento mostrato a destra del titolo. */
  action?: ReactNode;
}) {
  const { banned } = useSession();

  if (banned) {
    return (
      <div className="app-frame bg-background">
        <div className="grid min-h-screen place-items-center px-6 text-center">
          <div>
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-destructive/10 text-destructive">
              <Ban className="h-10 w-10" strokeWidth={2.4} />
            </span>
            <h1 className="mt-5 text-3xl">Sei stato escluso dal gioco</h1>
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
        <header className="sticky top-0 z-[800] bg-background/85 px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[2rem] leading-none text-foreground">{title}</h1>
              {subtitle && (
                <p className="mt-1.5 truncate text-sm font-medium text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {action}
          </div>
        </header>
      )}
      <main className={bare ? "" : "px-5 pt-3"}>{children}</main>
      <LiveAlerts />
      <BottomNav />
    </div>
  );
}
