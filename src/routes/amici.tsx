import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  Loader2,
  MessageCircle,
  Search,
  Swords,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { CoopPicker } from "@/components/CoopPicker";
import { Plate } from "@/components/Plate";
import { useShopItems } from "@/lib/useShop";
import {
  addFriend,
  countCreated,
  fetchFindsFor,
  fetchSpecialBadges,
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
    friendIds.has(id)
      ? "friend"
      : outgoingIds.has(id)
        ? "sent"
        : incomingIds.has(id)
          ? "received"
          : "none";

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
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nickname…"
          aria-label="Cerca per nickname"
          className="w-full rounded-2xl border border-input bg-card py-3.5 pl-12 pr-4 text-base shadow-pebble outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
        />
      </label>
      <Link
        to="/messaggi"
        className="press bg-brand mt-3 flex items-center gap-3 rounded-[1.4rem] p-3 pr-4 text-white shadow-glow"
      >
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/20">
          <MessageCircle className="h-6 w-6" />
        </span>
        <span className="flex-1 font-extrabold">I miei messaggi</span>
        <ChevronRight className="h-5 w-5" />
      </Link>

      {trimmed.length >= 2 && (
        <div className="mt-3 space-y-2">
          {searchQuery.isLoading && (
            <p className="pebble-card flex items-center gap-2 p-4 text-sm font-semibold text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cerco…
            </p>
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
          <SectionTitle label="Richieste ricevute" count={incoming.length} />
          <div className="mt-2 space-y-2">
            {incoming.map((person) => (
              <div
                key={person.id}
                className="pebble-card flex items-center gap-3 rounded-[1.3rem] p-2.5 ring-2 ring-primary/25"
              >
                <Avatar name={person.nickname} src={person.avatar_url} />
                <p className="min-w-0 flex-1 truncate font-extrabold">@{person.nickname}</p>
                <button
                  onClick={() => void accept(person)}
                  className="press inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-extrabold text-primary-foreground"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} /> Accetta
                </button>
                <button
                  onClick={() =>
                    void removeFriend(userId!, person.id).then(() =>
                      queryClient.invalidateQueries({ queryKey: ["friends", userId] }),
                    )
                  }
                  aria-label="Rifiuta"
                  className="press grid h-8 w-8 place-items-center rounded-xl bg-muted text-muted-foreground"
                >
                  <X className="h-4 w-4" strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <SectionTitle label="Richieste inviate" count={outgoing.length} />
          <div className="mt-2 space-y-2">
            {outgoing.map((person) => (
              <Row
                key={person.id}
                person={person}
                state="sent"
                onToggle={() => void toggleFriend(person)}
                onOpen={() => setOpenProfile(person)}
              />
            ))}
          </div>
        </>
      )}

      <SectionTitle label="I miei amici" count={friends.length} />
      <div className="mt-2 space-y-2">
        {friends.length === 0 && (
          <div className="pebble-card flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
              <Users className="h-5 w-5" />
            </span>
            Non hai ancora amici. Cerca un nickname e aggiungilo!
          </div>
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

      {openProfile && (
        <ProfileSheet
          person={openProfile}
          userId={userId}
          isFriend={stateOf(openProfile.id) === "friend"}
          onClose={() => setOpenProfile(null)}
        />
      )}
    </AppShell>
  );
}

type RelState = "friend" | "sent" | "received" | "none";

function SectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="mb-2.5 mt-7 flex items-center gap-2 text-xl">
      {label}
      <span className="rounded-full bg-secondary px-2 py-0.5 font-sans text-xs font-extrabold text-secondary-foreground">
        {count}
      </span>
    </h2>
  );
}

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
  const { byId } = useShopItems();
  const plate = person.plate_id ? byId.get(person.plate_id) : null;
  return (
    <div className="pebble-card flex items-center gap-3 rounded-[1.3rem] p-2.5">
      <button
        onClick={onOpen}
        className="press"
        aria-label={`Apri il profilo di ${person.nickname}`}
      >
        <Avatar name={person.nickname} src={person.avatar_url} />
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate font-extrabold">@{person.nickname}</p>
        {plate && (
          <div className="my-0.5">
            <Plate label={plate.label} style={plate.style} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">Serie migliore: {person.streak_best} giorni</p>
      </button>
      <button
        onClick={onToggle}
        className={`press inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-extrabold ${
          state === "friend" || state === "sent"
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {state === "friend" ? (
          <>
            <UserMinus className="h-3.5 w-3.5" /> Rimuovi
          </>
        ) : state === "sent" ? (
          "Annulla richiesta"
        ) : state === "received" ? (
          <>
            <Check className="h-3.5 w-3.5" strokeWidth={3} /> Accetta
          </>
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5" /> Chiedi amicizia
          </>
        )}
      </button>
    </div>
  );
}

function ProfileSheet({
  person,
  userId,
  isFriend,
  onClose,
}: {
  person: ProfileRow;
  userId: string | null;
  isFriend: boolean;
  onClose: () => void;
}) {
  const { byId } = useShopItems();
  const plate = person.plate_id ? byId.get(person.plate_id) : null;
  const [coop, setCoop] = useState(false);
  const statsQuery = useQuery({
    queryKey: ["profile-stats", person.id],
    queryFn: async () => {
      const [finds, created] = await Promise.all([
        fetchFindsFor(person.id),
        countCreated(person.id),
      ]);
      return { finds, created };
    },
  });

  const specialQuery = useQuery({
    queryKey: ["special-badges", person.id],
    queryFn: () => fetchSpecialBadges(person.id),
  });

  const finds = statsQuery.data?.finds ?? [];
  const created = statsQuery.data?.created ?? 0;
  const specials = (specialQuery.data ?? []).map((id) => byId.get(id)).filter((b) => b != null);
  const earned = earnedBadgeIds({
    created,
    found: finds.length,
    finds,
    streak: person.streak_best,
  });

  const categories = [...new Set(BADGES.map((b) => b.category))] as BadgeCategory[];

  return (
    <div
      className="fixed inset-0 z-[950] flex items-end bg-ink/40 backdrop-blur-[2px] animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="mx-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[2.25rem] bg-card p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lift animate-in slide-in-from-bottom-10 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
        <div className="flex flex-col items-center text-center">
          <Avatar
            name={person.nickname}
            src={person.avatar_url}
            className="h-20 w-20 text-4xl shadow-lift ring-4 ring-secondary"
          />
          <h2 className="mt-3 max-w-full truncate text-[1.75rem] leading-tight">
            @{person.nickname}
          </h2>
          {plate && (
            <div className="mt-1">
              <Plate label={plate.label} style={plate.style} size="md" />
            </div>
          )}
          <p className="mt-2 whitespace-pre-line break-words text-sm text-muted-foreground">
            {person.bio || "Nessuna descrizione."}
          </p>
        </div>
        {isFriend ? (
          <Link
            to="/chat/$id"
            params={{ id: person.id }}
            className="press bg-brand mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-extrabold text-white shadow-glow"
          >
            <MessageCircle className="h-5 w-5" /> Invia un messaggio
          </Link>
        ) : (
          <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-center text-xs font-semibold text-muted-foreground">
            Potete scrivervi quando siete amici: mandagli una richiesta di amicizia.
          </p>
        )}
        {isFriend && userId && (
          <button
            type="button"
            onClick={() => setCoop(true)}
            className="press mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 font-extrabold text-ink-foreground"
          >
            <Swords className="h-5 w-5 text-lime" /> Missione Co-op (30 min, punti ×2)
          </button>
        )}
        {coop && userId && (
          <CoopPicker userId={userId} partner={person} onClose={() => setCoop(false)} />
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Trovati", finds.length],
            ["Creati", created],
            ["Badge", earned.length + specials.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-muted p-3">
              <p className="font-display text-2xl">{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
            </div>
          ))}
        </div>

        {specials.length > 0 && (
          <div className="mt-5">
            <h3 className="text-lg">Speciali</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {specials.map((badge) => (
                <span
                  key={badge.id}
                  className="bg-brand flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold text-white shadow-glow"
                >
                  {badge.icon} {badge.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {categories.map((category) => {
          const unlockedInCategory = BADGES.filter(
            (b) => b.category === category && earned.includes(b.id),
          );
          if (unlockedInCategory.length === 0) return null;
          return (
            <div key={category} className="mt-5">
              <h3 className="text-lg">{CATEGORY_LABELS[category]}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {unlockedInCategory.map((badge) => (
                  <span
                    key={badge.id}
                    className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-extrabold text-secondary-foreground"
                  >
                    {badge.icon} {badge.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {earned.length + specials.length === 0 && !statsQuery.isLoading && (
          <p className="mt-5 text-sm text-muted-foreground">Nessun traguardo sbloccato per ora.</p>
        )}
      </div>
    </div>
  );
}
