import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Coins, Hourglass, Loader2, Lock, Target } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Plate } from "@/components/Plate";
import { SpecialBadge } from "@/components/SpecialBadge";
import {
  buyItem,
  equipPlate,
  fetchMyPurchases,
  fetchRewardProgress,
  fetchRocks,
  fetchWallet,
  type ShopItem,
} from "@/lib/api";
import { describeUnlock, isAvailable, periodLabel } from "@/lib/rewards";
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
  const progress = useQuery({
    queryKey: ["reward-progress", userId],
    queryFn: fetchRewardProgress,
    enabled: Boolean(userId),
  });
  const available = items.filter((i) => isAvailable(i));
  const needsRocks = available.some((i) => i.unlock?.type === "rock");
  const rocks = useQuery({ queryKey: ["rocks"], queryFn: fetchRocks, enabled: needsRocks });
  const rockName = (id?: string) => rocks.data?.find((r) => r.id === id)?.name;

  const ownedSet = new Set(owned.data ?? []);
  const balance = wallet.data?.balance ?? 0;

  async function buy(item: ShopItem) {
    setBusy(item.id);
    try {
      await buyItem(item.id);
      if (item.kind === "plate") await equipPlate(item.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["wallet", userId] }),
        queryClient.invalidateQueries({ queryKey: ["purchases", userId] }),
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
        refresh(),
      ]);
      toast.success(
        item.kind === "plate"
          ? `Targhetta “${item.label}” tua! L'hai già indossata.`
          : `${item.icon} Badge “${item.label}” tuo! Lo trovi nella collezione.`,
      );
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

  const sections: Array<[string, string, ShopItem[]]> = [
    [
      "Targhette",
      "Da mostrare in classifica e agli amici",
      available.filter((i) => i.kind === "plate"),
    ],
    [
      "Badge speciali",
      "Si aggiungono alla tua collezione",
      available.filter((i) => i.kind === "badge"),
    ],
  ];

  return (
    <AppShell title="Negozio" subtitle="Targhette e badge speciali, anche a tempo limitato">
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

      {isLoading && (
        <p className="pebble-card mt-4 flex items-center gap-2 p-4 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico il negozio…
        </p>
      )}

      {sections.map(([title, subtitle, list]) =>
        list.length === 0 ? null : (
          <section key={title} className="mt-5">
            <h2 className="px-1 text-xl">{title}</h2>
            <p className="px-1 text-xs text-muted-foreground">{subtitle}</p>
            <div className="mt-2 space-y-3">
              {list.map((item) => {
                const mine = ownedSet.has(item.id);
                const on = profile?.plate_id === item.id;
                const price = item.price;
                const short = !mine && price != null && balance < price;
                const period = periodLabel(item);
                const step = progress.data?.get(item.id);
                return (
                  <article key={item.id} className="pebble-card rounded-[1.5rem] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {item.kind === "plate" ? (
                          <Plate label={item.label} style={item.style} size="md" />
                        ) : (
                          <SpecialBadge icon={item.icon} label={item.label} />
                        )}
                        {item.description && (
                          <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                      {price != null && (
                        <span className="shrink-0 font-display text-lg">
                          {price.toLocaleString("it-IT")}
                          <span className="ml-0.5 text-xs font-bold text-muted-foreground">pt</span>
                        </span>
                      )}
                    </div>

                    {period && (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-sun/25 px-2.5 py-1 text-[11px] font-extrabold">
                        <Hourglass className="h-3 w-3" /> Edizione limitata · {period}
                      </p>
                    )}

                    {item.unlock && !mine && (
                      <div className="mt-3 rounded-2xl bg-secondary/60 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-extrabold">
                          <Target className="h-3.5 w-3.5 text-primary" />
                          {price != null ? "Oppure gratis se: " : "Si sblocca se: "}
                          {describeUnlock(item.unlock, rockName(item.unlock.ref))}
                          {(item.starts_at || item.ends_at) && item.unlock.type !== "streak"
                            ? " nel periodo"
                            : ""}
                        </p>
                        {step && (
                          <>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-card">
                              <div
                                className="bg-brand h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, (step.progress / Math.max(1, step.goal)) * 100)}%`,
                                }}
                              />
                            </div>
                            <p className="mt-1 text-right text-[11px] font-bold text-muted-foreground">
                              {Math.min(step.progress, step.goal).toLocaleString("it-IT")}/
                              {step.goal.toLocaleString("it-IT")}
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    <div className="mt-3">
                      {mine && item.kind === "plate" ? (
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
                      ) : mine ? (
                        <p className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-moss/15 py-3 text-sm font-extrabold text-[oklch(0.45_0.12_162)]">
                          <Check className="h-4 w-4" strokeWidth={3} /> Ce l'hai
                        </p>
                      ) : price != null ? (
                        <button
                          type="button"
                          disabled={busy !== null || short || !wallet.data}
                          onClick={() => void buy(item)}
                          className="press bg-brand flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-extrabold text-white shadow-glow disabled:bg-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                        >
                          {busy === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : short ? (
                            <>
                              <Lock className="h-4 w-4" /> Ti mancano{" "}
                              {(price - balance).toLocaleString("it-IT")} punti
                            </>
                          ) : item.kind === "plate" ? (
                            "Compra e indossa"
                          ) : (
                            "Compra"
                          )}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ),
      )}
    </AppShell>
  );
}
