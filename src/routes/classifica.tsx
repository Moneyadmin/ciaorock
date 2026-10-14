import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
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

  return (
    <AppShell title="Classifica" subtitle="10 punti per sasso trovato · 15 per sasso creato">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SORTS.map((option) => (
          <button
            key={option.key}
            onClick={() => setSort(option.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
              sort === option.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {query.isLoading && (
          <p className="pebble-card p-5 text-sm text-muted-foreground">Carico la classifica…</p>
        )}
        {!query.isLoading && rows.length === 0 && (
          <p className="pebble-card p-5 text-sm text-muted-foreground">
            Nessun cercatore in classifica. Sii il primo a nascondere un sasso! 🪨
          </p>
        )}
        {rows.map((row, index) => (
          <article
            key={row.id}
            className={`pebble-card flex items-center gap-3 p-3 ${
              row.id === userId ? "border-2 border-primary" : ""
            }`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-base font-bold">
              {medal(index)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">
                @{row.nickname}
                {row.id === userId && (
                  <span className="ml-2 text-xs font-bold text-primary">tu</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.found} trovati · {row.created} creati · serie {row.streak_best}
              </p>
            </div>
            <span className="shrink-0 text-lg font-bold text-foreground">{value(row, sort)}</span>
          </article>
        ))}
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
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return String(index + 1);
}
