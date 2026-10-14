import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  addFriend,
  countCreated,
  fetchFindsFor,
  fetchFriendState,
  acceptFriend,
  removeFriend,
  searchProfiles,
  type ProfileRow,
} from "@/lib/api";
import { BADGES, CATEGORY_LABELS, earnedBadgeIds, type BadgeCategory } from "@/lib/badges";
import { useSession } from "@/lib/useSession";

export const Route = createFileRoute("/amici")({
  head: () => ({
    meta: [
      { title: "Amici cercatori di sassi — RockDex" },
      {
        name: "description",
        content:
          "Cerca altri cercatori per nickname, aggiungili agli amici e guarda i loro profili e traguardi su RockDex.",
      },
      { property: "og:title", content: "Amici cercatori — RockDex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Trova amici per nickname e confronta collezioni e badge.",
      },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const { loading, userId, profile } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [openProfile, setOpenProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    if (!loading && (!userId || !profile)) navigate({ to: "/auth" });
  }, [loading, userId, profile, navigate]);

  const friendsQuery = useQuery({
    queryKey: ["friends", userId],
    queryFn: () => fetchFriendState(userId!),
    enabled: Boolean(userId),
  });

  const trimmed = query.trim();
  const searchQuery = useQuery({
    queryKey: ["search-profiles", trimmed],
    queryFn: () => searchProfiles(trimmed),
    enabled: trimmed.length >= 2,
  });

  const friends = friendsQuery.data?.friends ?? [];
  const incoming = friendsQuery.data?.incoming ?? [];
  const outgoing = friendsQuery.data?.outgoing ?? [];
  const friendIds = new Set(friends.map((f) => f.id));
  const outgoingIds = new Set(outgoing.map((f) => f.id));
  const incomingIds = new Set(incoming.map((f) => f.id));
  const stateOf = (id: string): RelState =>
    friendIds.has(id) ? "friend" : outgoingIds.has(id) ? "sent" : incomingIds.has(id) ? "received" : "none";

  async function accept(person: ProfileRow) {
    if (!userId) return;
    await acceptFriend(person.id, userId);
    await queryClient.invalidateQueries({ queryKey: ["friends", userId] });
  }
  const results = (searchQuery.data ?? []).filter((p) => p.id !== userId);

  async function toggleFriend(friend: ProfileRow) {
    if (!userId) return;
    const st = stateOf(friend.id);
    if (st === "friend" || st === "sent") await removeFriend(userId, friend.id);
    else await addFriend(friend.id);
    await queryClient.invalidateQueries({ queryKey: ["friends", userId] });
  }

  return (
    <AppShell title="Amici" subtitle="Cerca altri cercatori per nickname">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 Cerca per nickname…"
        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-ring"
      />
      <Link
        to="/messaggi"
        className="pebble-card mt-3 block p-3 text-center font-bold text-primary"
      >
        💬 I miei messaggi
      </Link>

      {trimmed.length >= 2 && (
        <div className="mt-3 space-y-2">
          {searchQuery.isLoading && (
            <p className="pebble-card p-4 text-sm text-muted-foreground">Cerco…</p>
          )}
          {!searchQuery.isLoading && results.length === 0 && (
            <p className="pebble-card p-4 text-sm text-muted-foreground">
              Nessun cercatore trovato con questo nickname.
            </p>
          )}
          {results.map((person) => (
            <Row
              key={person.id}
              person={person}
              state={stateOf(person.id)}
              onToggle={() => void toggleFriend(person)}
              onOpen={() => setOpenProfile(person)}
            />
          ))}
        </div>
      )}

      {incoming.length > 0 && (
        <>
          <h2 className="mt-6 text-lg font-bold">Richieste ricevute ({incoming.length})</h2>
          <div className="mt-2 space-y-2">
            {incoming.map((person) => (
              <div key={person.id} className="pebble-card flex items-center gap-3 p-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-xl">👋</span>
                <p className="min-w-0 flex-1 truncate font-bold">@{person.nickname}</p>
                <button
                  onClick={() => void accept(person)}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  Accetta
                </button>
                <button
                  onClick={() =>
                    void removeFriend(userId!, person.id).then(() =>
                      queryClient.invalidateQueries({ queryKey: ["friends", userId] }),
                    )
                  }
                  className="rounded-xl bg-muted px-3 py-2 text-xs font-bold text-muted-foreground"
                >
                  Rifiuta
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <h2 className="mt-6 text-lg font-bold">Richieste inviate ({outgoing.length})</h2>
          <div className="mt-2 space-y-2">
            {outgoing.map((person) => (
              <Row key={person.id} person={person} state="sent" onToggle={() => void toggleFriend(person)} onOpen={() => setOpenProfile(person)} />
            ))}
          </div>
        </>
      )}

      <h2 className="mt-6 text-lg font-bold">I miei amici ({friends.length})</h2>
      <div className="mt-2 space-y-2">
        {friends.length === 0 && (
          <p className="pebble-card p-4 text-sm text-muted-foreground">
            Non hai ancora amici. Cerca un nickname e aggiungilo! 👥
          </p>
        )}
        {friends.map((person) => (
          <Row
            key={person.id}
            person={person}
            state="friend"
            onToggle={() => void toggleFriend(person)}
            onOpen={() => setOpenProfile(person)}
          />
        ))}
      </div>

      {openProfile && <ProfileSheet person={openProfile} onClose={() => setOpenProfile(null)} />}
    </AppShell>
  );
}

type RelState = "friend" | "sent" | "received" | "none";

function Row({
  person,
  state,
  onToggle,
  onOpen,
}: {
  person: ProfileRow;
  state: RelState;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="pebble-card flex items-center gap-3 p-3">
      <button
        onClick={onOpen}
        className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-xl"
        aria-label={`Apri il profilo di ${person.nickname}`}
      >
        🪨
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate font-bold">@{person.nickname}</p>
        <p className="text-xs text-muted-foreground">
          Serie migliore: {person.streak_best} giorni
        </p>
      </button>
      <button
        onClick={onToggle}
        className={`rounded-xl px-3 py-2 text-xs font-bold ${
          state === "friend" || state === "sent" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        {state === "friend" ? "Rimuovi" : state === "sent" ? "Annulla richiesta" : state === "received" ? "Accetta" : "Chiedi amicizia"}
      </button>
    </div>
  );
}

function ProfileSheet({ person, onClose }: { person: ProfileRow; onClose: () => void }) {
  const statsQuery = useQuery({
    queryKey: ["profile-stats", person.id],
    queryFn: async () => {
      const [finds, created] = await Promise.all([fetchFindsFor(person.id), countCreated(person.id)]);
      return { finds, created };
    },
  });

  const finds = statsQuery.data?.finds ?? [];
  const created = statsQuery.data?.created ?? 0;
  const earned = earnedBadgeIds({
    created,
    found: finds.length,
    finds,
    streak: person.streak_best,
  });

  const categories = [...new Set(BADGES.map((b) => b.category))] as BadgeCategory[];

  return (
    <div className="fixed inset-0 z-[900] flex items-end bg-foreground/30" onClick={onClose}>
      <div
        className="mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] border-t border-border bg-card p-5 pb-28 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <div className="flex items-center gap-3">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-3xl">🪨</span>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold leading-tight">@{person.nickname}</h2>
            <p className="text-sm text-muted-foreground">{person.bio || "Nessuna descrizione."}</p>
          </div>
        </div>
        <Link
          to="/chat/$id"
          params={{ id: person.id }}
          className="mt-4 block w-full rounded-xl bg-primary py-3 text-center font-bold text-primary-foreground"
        >
          Invia un messaggio 💬
        </Link>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-muted p-3">
            <p className="text-2xl font-bold">{finds.length}</p>
            <p className="text-xs font-semibold text-muted-foreground">Trovati</p>
          </div>
          <div className="rounded-2xl bg-muted p-3">
            <p className="text-2xl font-bold">{created}</p>
            <p className="text-xs font-semibold text-muted-foreground">Creati</p>
          </div>
          <div className="rounded-2xl bg-muted p-3">
            <p className="text-2xl font-bold">{earned.length}</p>
            <p className="text-xs font-semibold text-muted-foreground">Badge</p>
          </div>
        </div>

        {categories.map((category) => {
          const unlockedInCategory = BADGES.filter(
            (b) => b.category === category && earned.includes(b.id),
          );
          if (unlockedInCategory.length === 0) return null;
          return (
            <div key={category} className="mt-5">
              <h3 className="text-base font-bold">{CATEGORY_LABELS[category]}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {unlockedInCategory.map((badge) => (
                  <span
                    key={badge.id}
                    className="flex items-center gap-2 rounded-full bg-accent px-3 py-2 text-sm font-bold text-accent-foreground"
                  >
                    {badge.icon} {badge.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {earned.length === 0 && !statsQuery.isLoading && (
          <p className="mt-5 text-sm text-muted-foreground">Nessun traguardo sbloccato per ora.</p>
        )}
      </div>
    </div>
  );
}
