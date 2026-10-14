import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Crown, Loader2, Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { avatarGradient, initialOf } from "@/lib/pins";
import { fetchLeaderboard, type LeaderRow } from "@/lib/api";
import { useSession } from "@/lib/useSession";

export const Route = createFileRoute("/classifica")({
  head: () => ({
    meta: [
      { title: "Classifica cercatori — RockDex" },
      {
        name: "description",
        content:
          "La classifica RockDex dei migliori cercatori: punti, sassi trovati, sassi creati e serie di giorni consecutivi.",
      },
      { property: "og:title", content: "Classifica cercatori — RockDex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Scopri chi guida la caccia ai sassi dipinti.",
      },
    ],
  }),
  component: LeaderboardPage,
});

type SortKey = "points" | "found" | "created" | "streak_best";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "points", label: "Punti" },
  { key: "found", label: "Trovati" },
  { key: "created", label: "Creati" },
  { key: "streak_best", label: "Serie" },
];

function LeaderboardPage() {
  const { userId } = useSession();
  const [sort, setSort] = useState<SortKey>("points");

  const query = useQuery({ queryKey: ["leaderboard"], queryFn: fetchLeaderboard });
  const rows = [...(query.data ?? [])].sort((a, b) => value(b, sort) - value(a, sort));

  const podium = rows.length >= 3 ? rows.slice(0, 3) : [];
  const rest = podium.length ? rows.slice(3) : rows;

  return (
    <AppShell title="Classifica" subtitle="10 punti per sasso trovato · 15 per sasso creato">
      <div className="flex gap-1 rounded-2xl bg-muted p-1" role="tablist">
        {SORTS.map((option) => (
          <button
            key={option.key}
            role="tab"
            aria-selected={sort === option.key}
            onClick={() => setSort(option.key)}
            className={`press flex-1 rounded-xl py-2.5 text-xs font-extrabold ${
              sort === option.key ? "bg-ink text-ink-foreground shadow-pebble" : "text-muted-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {query.isLoading && (
        <p className="pebble-card mt-4 flex items-center gap-2 p-5 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico la classifica…
        </p>
      )}
      {!query.isLoading && rows.length === 0 && (
        <div className="pebble-card mt-4 p-6 text-center">
          <span className="bg-brand mx-auto grid h-14 w-14 place-items-center rounded-2xl text-white shadow-glow">
            <Trophy className="h-7 w-7" />
          </span>
          <p className="mt-3 text-sm text-muted-foreground">
            Nessun cercatore in classifica. Sii il primo a nascondere un sasso!
          </p>
        </div>
      )}

      {podium.length > 0 && (
        <div className="bg-brand relative mt-4 overflow-hidden rounded-[1.75rem] px-3 pb-0 pt-5 text-white shadow-glow">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative grid grid-cols-3 items-end gap-2">
            {[1, 0, 2].map((i) => {
              const row = podium[i]!;
              const first = i === 0;
              return (
                <div key={row.id} className="flex flex-col items-center text-center">
                  {first && <Crown className="mb-1 h-6 w-6 text-sun" fill="currentColor" />}
                  <span
                    className={`grid place-items-center rounded-full border-[3px] font-display text-white shadow-lift ${
                      first ? "h-[4.5rem] w-[4.5rem] border-sun text-3xl" : "h-14 w-14 border-white/80 text-2xl"
                    }`}
                    style={{ background: avatarGradient(row.nickname) }}
                  >
                    {initialOf(row.nickname)}
                  </span>
                  <p className="mt-1.5 w-full truncate text-xs font-extrabold">
                    @{row.nickname}
                    {row.id === userId && " (tu)"}
                  </p>
                  <p className="font-display text-lg leading-tight">{value(row, sort).toLocaleString("it-IT")}</p>
                  <div
                    className={`mt-2 grid w-full place-items-center rounded-t-2xl bg-white/20 font-display text-2xl backdrop-blur ${
                      first ? "h-20" : i === 1 ? "h-14" : "h-10"
                    }`}
                  >
                    {i + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {rest.map((row) => {
          const index = rows.indexOf(row);
          const me = row.id === userId;
          return (
            <article
              key={row.id}
              className={`flex items-center gap-3 rounded-[1.3rem] p-2.5 pr-4 ${
                me ? "bg-ink text-ink-foreground shadow-lift" : "pebble-card"
              }`}
            >
              <span
                className={`w-7 shrink-0 text-center font-display text-lg ${me ? "text-lime" : "text-muted-foreground"}`}
              >
                {medal(index)}
              </span>
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-base text-white"
                style={{ background: avatarGradient(row.nickname) }}
              >
                {initialOf(row.nickname)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">
                  @{row.nickname}
                  {me && (
                    <span className="ml-2 rounded-full bg-lime px-2 py-0.5 text-[10px] font-extrabold text-ink">TU</span>
                  )}
                </p>
                <p className={`text-xs ${me ? "text-white/60" : "text-muted-foreground"}`}>
                  {row.found} trovati · {row.created} creati · serie {row.streak_best}
                </p>
              </div>
              <span className="shrink-0 font-display text-xl">{value(row, sort).toLocaleString("it-IT")}</span>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}

function value(row: LeaderRow, key: SortKey) {
  return key === "points"
    ? row.points
    : key === "found"
      ? row.found
      : key === "created"
        ? row.created
        : row.streak_best;
}

function medal(index: number) {
  return String(index + 1);
}
