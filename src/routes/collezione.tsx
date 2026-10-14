import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  Flame,
  Gem,
  GraduationCap,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Shield,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { NotificationSettings } from "@/components/NotificationSettings";
import { Tutorial } from "@/components/Tutorial";
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
  const [tutorial, setTutorial] = useState(false);

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
        <Stat
          label="Trovati"
          value={finds.length}
          icon={<Gem className="h-4 w-4" />}
          tone="bg-primary text-primary-foreground"
        />
        <Stat
          label="Creati"
          value={created}
          icon={<Sparkles className="h-4 w-4" />}
          tone="bg-paint text-paint-foreground"
        />
        <Stat
          label="Badge"
          value={earned.length}
          icon={<Award className="h-4 w-4" />}
          tone="bg-sun text-ink"
        />
        <Stat
          label="Serie"
          value={profile?.streak_current ?? 0}
          icon={<Flame className="h-4 w-4" />}
          tone="bg-lime text-ink"
        />
      </div>

      <div className="mt-4">
        <NotificationSettings />
      </div>

      <div className="mt-5 flex rounded-2xl bg-muted p-1 text-sm font-extrabold" role="tablist">
        {(["collezione", "traguardi"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`press flex-1 rounded-xl py-2.5 ${
              tab === t ? "bg-ink text-ink-foreground shadow-pebble" : "text-muted-foreground"
            }`}
          >
            {t === "collezione"
              ? `Collezione · ${finds.length}`
              : `Traguardi · ${earned.length}/${BADGES.length}`}
          </button>
        ))}
      </div>

      {tab === "collezione" ? (
        <div className="mt-4">
          {findsQuery.isLoading && (
            <p className="pebble-card flex items-center gap-2 p-5 text-sm font-semibold text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carico la collezione…
            </p>
          )}
          {!findsQuery.isLoading && finds.length === 0 && (
            <div className="pebble-card p-6 text-center">
              <span className="bg-brand mx-auto grid h-14 w-14 place-items-center rounded-2xl text-white shadow-glow">
                <MapPin className="h-7 w-7" />
              </span>
              <p className="mt-3 font-display text-xl">Nessun sasso, per ora</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Apri la mappa e segui gli indizi: il primo sasso che trovi finisce qui.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {finds.map((find) => (
              <article key={find.id} className="pebble-card overflow-hidden rounded-[1.4rem] p-1.5">
                <img
                  src={find.photo || find.rock?.photo || ""}
                  alt={`Sasso dipinto trovato: ${find.rock?.name ?? "sasso"}`}
                  className="aspect-square w-full rounded-[1.1rem] object-cover"
                  loading="lazy"
                />
                <div className="px-1.5 pb-1.5 pt-2">
                  <h2 className="truncate text-base leading-tight">
                    {find.rock?.name ?? "Sasso rimosso"}
                  </h2>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">
                    {new Date(find.found_at).toLocaleDateString("it-IT", {
                      day: "numeric",
                      month: "short",
                    })}
                    {find.city ? ` · ${find.city}` : ""}
                  </p>
                  {find.rock?.clue && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {find.rock.clue}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {grouped.map(([category, badges]) => {
            const got = badges.filter((b) => earned.includes(b.id)).length;
            return (
              <section key={category}>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xl">{CATEGORY_LABELS[category]}</h2>
                  <span className="text-xs font-extrabold text-muted-foreground">
                    {got}/{badges.length}
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                  {badges.map((badge) => {
                    const unlocked = earned.includes(badge.id);
                    return (
                      <article
                        key={badge.id}
                        title={badge.description}
                        className={`relative flex flex-col items-center rounded-[1.3rem] p-2.5 pb-3 text-center ${
                          unlocked ? "bg-card shadow-pebble ring-1 ring-border" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`grid h-14 w-14 place-items-center rounded-[1.1rem] text-[1.7rem] ${
                            unlocked
                              ? `${CATEGORY_TONE[category]} shadow-pebble`
                              : "bg-border/70 grayscale"
                          }`}
                        >
                          <span className={unlocked ? "" : "opacity-35"}>{badge.icon}</span>
                        </span>
                        {!unlocked && (
                          <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-card text-muted-foreground">
                            <Lock className="h-3 w-3" strokeWidth={2.8} />
                          </span>
                        )}
                        <p
                          className={`mt-2 line-clamp-2 text-[11px] font-extrabold leading-tight ${
                            unlocked ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {badge.name}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                          {badge.description}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {admin && (
        <button
          onClick={() => navigate({ to: "/admin" })}
          className="press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-sm font-extrabold text-ink-foreground"
        >
          <Shield className="h-4 w-4" /> Pannello admin
        </button>
      )}

      {tutorial && userId && <Tutorial userId={userId} onClose={() => setTutorial(false)} />}

      <button
        onClick={() => setTutorial(true)}
        className="press mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-3.5 text-sm font-extrabold text-secondary-foreground"
      >
        <GraduationCap className="h-4 w-4" /> Rivedi il tutorial
      </button>

      <button
        onClick={logout}
        className="press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-3.5 text-sm font-extrabold text-muted-foreground"
      >
        <LogOut className="h-4 w-4" /> Esci dall'account
      </button>
    </AppShell>
  );
}

const CATEGORY_TONE: Record<BadgeCategory, string> = {
  creatore: "bg-gradient-to-br from-[#b9a6ff] to-[#ff9bd0]",
  trovatore: "bg-gradient-to-br from-[#ffd36b] to-[#ff9f5c]",
  tempo: "bg-gradient-to-br from-[#9fdcff] to-[#b9a6ff]",
  serie: "bg-gradient-to-br from-[#e4ff7a] to-[#8ef0b8]",
  luogo: "bg-gradient-to-br from-[#8ef0b8] to-[#9fdcff]",
};

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="pebble-card flex flex-col items-center rounded-[1.3rem] px-1 py-3 text-center">
      <span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}>{icon}</span>
      <p className="mt-1.5 font-display text-2xl leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
