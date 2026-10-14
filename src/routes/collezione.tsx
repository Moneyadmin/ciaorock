import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { NotificationSettings } from "@/components/NotificationSettings";
import { BADGES, CATEGORY_LABELS, earnedBadgeIds, type BadgeCategory } from "@/lib/badges";
import { countCreated, fetchMyFinds } from "@/lib/api";
import { useSession } from "@/lib/useSession";

export const Route = createFileRoute("/collezione")({
  head: () => ({
    meta: [
      { title: "Il mio RockDex — collezione e traguardi" },
      {
        name: "description",
        content:
          "La tua collezione di sassi dipinti trovati e creati, con tutti i traguardi italiani sbloccati: creatore, trovatore, tempo, serie e luogo.",
      },
      { property: "og:title", content: "Il mio RockDex — collezione e traguardi" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Guarda i sassi che hai trovato e i badge che hai sbloccato.",
      },
    ],
  }),
  component: CollectionPage,
});

function CollectionPage() {
  const { loading, userId, profile, admin, signOut } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"collezione" | "traguardi">("collezione");

  useEffect(() => {
    if (!loading && (!userId || !profile)) navigate({ to: "/auth" });
  }, [loading, userId, profile, navigate]);

  const findsQuery = useQuery({
    queryKey: ["my-finds", userId],
    queryFn: () => fetchMyFinds(userId!),
    enabled: Boolean(userId),
  });

  const createdQuery = useQuery({
    queryKey: ["my-created", userId],
    queryFn: () => countCreated(userId!),
    enabled: Boolean(userId),
  });

  const finds = findsQuery.data ?? [];
  const created = createdQuery.data ?? 0;

  const earned = useMemo(
    () =>
      earnedBadgeIds({
        created,
        found: finds.length,
        finds,
        streak: profile?.streak_best ?? 0,
      }),
    [created, finds, profile],
  );

  const grouped = useMemo(() => {
    const map = new Map<BadgeCategory, typeof BADGES>();
    for (const badge of BADGES) {
      const list = map.get(badge.category) ?? [];
      list.push(badge);
      map.set(badge.category, list);
    }
    return [...map.entries()];
  }, []);

  async function logout() {
    await signOut();
    navigate({ to: "/auth" });
  }

  return (
    <AppShell title="Il mio RockDex" subtitle={profile ? `@${profile.nickname}` : undefined}>
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Trovati" value={finds.length} />
        <Stat label="Creati" value={created} />
        <Stat label="Badge" value={earned.length} />
        <Stat label="Serie" value={profile?.streak_current ?? 0} />
      </div>

      <div className="mt-4">
        <NotificationSettings />
      </div>

      <div className="mt-4 flex rounded-xl bg-muted p-1 text-sm font-bold">
        {(["collezione", "traguardi"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 ${
              tab === t ? "bg-card text-foreground shadow-pebble" : "text-muted-foreground"
            }`}
          >
            {t === "collezione" ? "Collezione" : "Traguardi"}
          </button>
        ))}
      </div>

      {tab === "collezione" ? (
        <div className="mt-4 space-y-3">
          {findsQuery.isLoading && (
            <p className="pebble-card p-5 text-sm text-muted-foreground">Carico la collezione…</p>
          )}
          {!findsQuery.isLoading && finds.length === 0 && (
            <p className="pebble-card p-5 text-sm text-muted-foreground">
              Non hai ancora trovato sassi. Apri la mappa e segui gli indizi! 🗺️
            </p>
          )}
          {finds.map((find) => (
            <article key={find.id} className="pebble-card flex gap-3 p-3">
              <img
                src={find.photo || find.rock?.photo || ""}
                alt={`Sasso dipinto trovato: ${find.rock?.name ?? "sasso"}`}
                className="h-20 w-20 shrink-0 rounded-xl object-cover"
                loading="lazy"
              />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold leading-tight">
                  {find.rock?.name ?? "Sasso rimosso"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {new Date(find.found_at).toLocaleDateString("it-IT")}
                  {find.city ? ` · ${find.city}` : ""}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{find.rock?.clue}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {grouped.map(([category, badges]) => (
            <section key={category}>
              <h2 className="text-lg font-bold">{CATEGORY_LABELS[category]}</h2>
              <div className="mt-2 space-y-2">
                {badges.map((badge) => {
                  const unlocked = earned.includes(badge.id);
                  return (
                    <article
                      key={badge.id}
                      className={`pebble-card flex items-center gap-3 p-3 ${unlocked ? "" : "opacity-60"}`}
                    >
                      <span
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl ${
                          unlocked ? "bg-accent" : "bg-muted"
                        }`}
                      >
                        {unlocked ? badge.icon : "🔒"}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold">{badge.name}</p>
                        <p className="text-sm text-muted-foreground">{badge.description}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {admin && (
        <button
          onClick={() => navigate({ to: "/admin" })}
          className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
        >
          🔐 Pannello admin
        </button>
      )}

      <button
        onClick={logout}
        className="mt-6 w-full rounded-xl border border-border bg-card py-3 text-sm font-bold text-muted-foreground"
      >
        Esci dall'account
      </button>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="pebble-card p-3 text-center">
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}
