import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Coins, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Plate } from "@/components/Plate";
import { buyItem, equipPlate, fetchMyPurchases, fetchWallet } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import { useShopItems } from "@/lib/useShop";

export const Route = createFileRoute("/negozio")({
  head: () => ({ meta: [{ title: "Negozio — Ciao Rock" }] }),
  component: ShopPage,
});

function ShopPage() {
  const { loading, userId, profile, refresh } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items, isLoading } = useShopItems();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!userId || !profile)) navigate({ to: "/auth" });
  }, [loading, userId, profile, navigate]);

  const wallet = useQuery({
    queryKey: ["wallet", userId],
    queryFn: fetchWallet,
    enabled: Boolean(userId),
  });
  const owned = useQuery({
    queryKey: ["purchases", userId],
    queryFn: () => fetchMyPurchases(userId!),
    enabled: Boolean(userId),
  });
  const ownedSet = new Set(owned.data ?? []);
  const balance = wallet.data?.balance ?? 0;

  async function buy(id: string, label: string) {
    setBusy(id);
    try {
      await buyItem(id);
      await equipPlate(id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["wallet", userId] }),
        queryClient.invalidateQueries({ queryKey: ["purchases", userId] }),
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
        refresh(),
      ]);
      toast.success(`Targhetta “${label}” tua! L'hai già indossata.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Acquisto non riuscito");
    } finally {
      setBusy(null);
    }
  }

  async function wear(id: string | null) {
    setBusy(id ?? "none");
    try {
      await equipPlate(id);
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["leaderboard"] })]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Non riuscito");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title="Negozio" subtitle="Targhette dorate da mostrare in classifica e agli amici">
      <div className="pebble-card flex items-center gap-3 rounded-[1.6rem] p-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sun text-ink">
          <Coins className="h-6 w-6" />
        </span>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Il tuo saldo
          </p>
          <p className="font-display text-2xl leading-none">
            {wallet.data ? balance.toLocaleString("it-IT") : "…"} punti
          </p>
        </div>
      </div>
      <p className="mt-2 px-2 text-xs text-muted-foreground">
        Comprare non ti fa scendere in classifica: spendi solo il saldo. Ogni giorno, al primo
        accesso, ricevi 15 punti bonus.
      </p>

      <div className="mt-4 space-y-3">
        {isLoading && (
          <p className="pebble-card flex items-center gap-2 p-4 text-sm font-semibold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carico il negozio…
          </p>
        )}
        {items.map((item) => {
          const mine = ownedSet.has(item.id);
          const on = profile?.plate_id === item.id;
          const short = !mine && balance < item.price;
          return (
            <article key={item.id} className="pebble-card rounded-[1.5rem] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Plate label={item.label} style={item.style} size="md" />
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </div>
                <span className="shrink-0 font-display text-lg">
                  {item.price.toLocaleString("it-IT")}
                  <span className="ml-0.5 text-xs font-bold text-muted-foreground">pt</span>
                </span>
              </div>
              <div className="mt-3">
                {mine ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void wear(on ? null : item.id)}
                    className={`press flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-extrabold ${
                      on
                        ? "bg-moss/15 text-[oklch(0.45_0.12_162)]"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {on ? (
                      <>
                        <Check className="h-4 w-4" strokeWidth={3} /> Indossata · tocca per
                        toglierla
                      </>
                    ) : (
                      "Indossa"
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy !== null || short || !wallet.data}
                    onClick={() => void buy(item.id, item.label)}
                    className="press bg-brand flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-extrabold text-white shadow-glow disabled:bg-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                  >
                    {busy === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : short ? (
                      <>
                        <Lock className="h-4 w-4" /> Ti mancano{" "}
                        {(item.price - balance).toLocaleString("it-IT")} punti
                      </>
                    ) : (
                      "Compra e indossa"
                    )}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
