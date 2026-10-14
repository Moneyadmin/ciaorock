import { supabase } from "@/integrations/supabase/client";
import type { FindRecord } from "@/lib/badges";

export type RockRow = {
  id: string;
  name: string;
  clue: string;
  lat: number;
  lng: number;
  difficulty: string;
  points: number;
  rating_avg: number | null;
  rating_count: number;
  move_count: number;
  created_at: string;
  creator_id: string;
  hidden_by: string | null;
  creator_nickname: string;
  hider_nickname: string | null;
  found_count: number;
};

export type ProfileRow = {
  id: string;
  nickname: string;
  bio: string;
  streak_current: number;
  streak_best: number;
};

type RockSelect = {
  id: string;
  name: string;
  clue: string;
  lat: number;
  lng: number;
  difficulty: string;
  points: number;
  rating_avg: number | null;
  rating_count: number;
  move_count: number;
  created_at: string;
  creator_id: string;
  hidden_by: string | null;
  creator: { nickname: string } | null;
  hider: { nickname: string } | null;
  finds: { count: number }[];
};

const ROCK_SELECT =
  "id,name,clue,lat,lng,difficulty,points,rating_avg,rating_count,move_count,created_at,creator_id,hidden_by,creator:profiles!rocks_creator_id_fkey(nickname),hider:profiles!rocks_hidden_by_fkey(nickname),finds(count)";

function mapRock(row: RockSelect): RockRow {
  return {
    id: row.id,
    name: row.name,
    clue: row.clue,
    lat: row.lat,
    lng: row.lng,
    difficulty: row.difficulty,
    points: row.points ?? 150,
    rating_avg: row.rating_avg == null ? null : Number(row.rating_avg),
    rating_count: row.rating_count ?? 0,
    move_count: row.move_count,
    created_at: row.created_at,
    creator_id: row.creator_id,
    hidden_by: row.hidden_by,
    creator_nickname: row.creator?.nickname ?? "Anonimo",
    hider_nickname: row.hider?.nickname ?? null,
    found_count: row.finds?.[0]?.count ?? 0,
  };
}

export async function fetchRocks(): Promise<RockRow[]> {
  const { data, error } = await supabase
    .from("rocks")
    .select(ROCK_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RockSelect[]).map(mapRock);
}

export async function fetchRockPhoto(rockId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("rocks")
    .select("photo")
    .eq("id", rockId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.photo ?? null;
}

export async function fetchRockMoveCount(rockId: string): Promise<number> {
  const { data, error } = await supabase
    .from("rocks")
    .select("move_count")
    .eq("id", rockId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.move_count ?? 0;
}

export async function fetchMyFinds(userId: string) {
  const { data, error } = await supabase
    .from("finds")
    .select(
      "id,found_at,photo,city,region,country,continent,rock:rocks(id,name,clue,photo,creator_id)",
    )
    .eq("user_id", userId)
    .order("found_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Array<
    FindRecord & {
      id: string;
      photo: string;
      rock: { id: string; name: string; clue: string; photo: string; creator_id: string } | null;
    }
  >;
}

export async function fetchFindsFor(userId: string): Promise<FindRecord[]> {
  const { data, error } = await supabase
    .from("finds")
    .select("found_at,city,region,country,continent")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as FindRecord[];
}

export async function countCreated(userId: string) {
  const { count, error } = await supabase
    .from("rocks")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function createRock(input: {
  name: string;
  clue: string;
  photo: string;
  lat: number;
  lng: number;
  difficulty: string;
}) {
  const { data, error } = await supabase.from("rocks").insert(input).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function moveRock(input: {
  rockId: string;
  clue: string;
  photo: string;
  lat: number;
  lng: number;
  userId: string;
  moveCount: number;
}) {
  const { error } = await supabase
    .from("rocks")
    .update({
      clue: input.clue,
      photo: input.photo,
      lat: input.lat,
      lng: input.lng,
      hidden_by: input.userId,
      move_count: input.moveCount + 1,
    })
    .eq("id", input.rockId);
  if (error) throw new Error(error.message);
}

export async function registerFind(input: {
  rockId: string;
  photo: string;
  lat: number | null;
  lng: number | null;
  place: {
    city: string | null;
    region: string | null;
    country: string | null;
    continent: string | null;
  };
}) {
  const { error } = await supabase.from("finds").insert({
    rock_id: input.rockId,
    photo: input.photo,
    lat: input.lat,
    lng: input.lng,
    city: input.place.city,
    region: input.place.region,
    country: input.place.country,
    continent: input.place.continent,
  });
  if (error) throw new Error(error.message);
}

export async function searchProfiles(query: string): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nickname,bio,streak_current,streak_best")
    .ilike("nickname", `%${query}%`)
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileRow[];
}

const PROFILE_COLS = "id,nickname,bio,streak_current,streak_best";

type FriendLink = { user_id: string; friend_id: string; status: string };

async function fetchLinks(userId: string): Promise<FriendLink[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_id,friend_id,status")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (error) throw new Error(error.message);
  return (data ?? []) as FriendLink[];
}

async function profilesByIds(ids: string[]): Promise<ProfileRow[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLS).in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileRow[];
}

export type FriendState = {
  friends: ProfileRow[];
  incoming: ProfileRow[];
  outgoing: ProfileRow[];
};

/** Amici confermati + richieste ricevute + richieste inviate. */
export async function fetchFriendState(userId: string): Promise<FriendState> {
  const links = await fetchLinks(userId);
  const other = (l: FriendLink) => (l.user_id === userId ? l.friend_id : l.user_id);
  const accepted = new Set(links.filter((l) => l.status === "accepted").map(other));
  const incoming = new Set(
    links.filter((l) => l.status === "pending" && l.friend_id === userId).map(other),
  );
  const outgoing = new Set(
    links.filter((l) => l.status === "pending" && l.user_id === userId).map(other),
  );
  for (const id of accepted) {
    incoming.delete(id);
    outgoing.delete(id);
  }
  const profs = await profilesByIds([...new Set([...accepted, ...incoming, ...outgoing])]);
  return {
    friends: profs.filter((p) => accepted.has(p.id)),
    incoming: profs.filter((p) => incoming.has(p.id)),
    outgoing: profs.filter((p) => outgoing.has(p.id) && !incoming.has(p.id)),
  };
}

export async function fetchFriends(userId: string) {
  return (await fetchFriendState(userId)).friends;
}

/** Invia una richiesta; se l'altro te l'aveva già chiesta, la accetta. */
export async function addFriend(friendId: string) {
  const { data: me } = await supabase.auth.getUser();
  const myId = me.user?.id;
  if (myId) {
    const { data: theirs } = await supabase
      .from("friendships")
      .select("id")
      .eq("user_id", friendId)
      .eq("friend_id", myId)
      .maybeSingle();
    if (theirs) return acceptFriend(friendId, myId);
  }
  const { error } = await supabase.from("friendships").insert({ friend_id: friendId });
  if (error) throw new Error(error.message);
}

export async function acceptFriend(requesterId: string, myId: string) {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("user_id", requesterId)
    .eq("friend_id", myId);
  if (error) throw new Error(error.message);
}

/** Rimuove amicizia o richiesta, in entrambe le direzioni. */
export async function removeFriend(userId: string, friendId: string) {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`,
    );
  if (error) throw new Error(error.message);
}

export type LeaderRow = {
  id: string;
  nickname: string;
  found: number;
  created: number;
  streak_best: number;
  points: number;
};

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

export type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export async function fetchProfileById(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nickname,bio,streak_current,streak_best")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProfileRow | null) ?? null;
}

/** Tutti i messaggi scambiati con una persona, dal più vecchio al più recente. */
export async function fetchConversation(meId: string, otherId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id,sender_id,recipient_id,body,created_at")
    .or(
      `and(sender_id.eq.${meId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${meId})`,
    )
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MessageRow[];
}

export async function sendMessage(recipientId: string, body: string) {
  const { error } = await supabase
    .from("messages")
    .insert({ recipient_id: recipientId, body: body.trim() });
  if (error) throw new Error(error.message);
}

export async function deleteMessage(id: string) {
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type InboxEntry = { other: ProfileRow; last: MessageRow };

/** Elenco delle conversazioni (ultimo messaggio per persona). */
export async function fetchInbox(meId: string): Promise<InboxEntry[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id,sender_id,recipient_id,body,created_at")
    .or(`sender_id.eq.${meId},recipient_id.eq.${meId}`)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const latest = new Map<string, MessageRow>();
  for (const m of (data ?? []) as MessageRow[]) {
    const other = m.sender_id === meId ? m.recipient_id : m.sender_id;
    if (!latest.has(other)) latest.set(other, m);
  }
  if (latest.size === 0) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id,nickname,bio,streak_current,streak_best")
    .in("id", [...latest.keys()]);
  const byId = new Map(((profs ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  return [...latest.entries()]
    .filter(([id]) => byId.has(id))
    .map(([id, last]) => ({ other: byId.get(id)!, last }));
}

/** Ultimo annuncio inviato dallo staff (usato per la notifica personalizzata). */
export async function fetchLatestAnnouncement(): Promise<AnnouncementRow | null> {
  const { data, error } = await supabase
    .from("announcements")
    .select("id,title,body,created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AnnouncementRow | null) ?? null;
}

export async function fetchDoubleDays(): Promise<Array<{ day: string; multiplier: number }>> {
  const { data, error } = await supabase.from("double_days").select("day,multiplier");
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ day: string; multiplier: number }>;
}

export async function fetchLeaderboard(): Promise<LeaderRow[]> {
  const [profiles, finds, rocks, doubles] = await Promise.all([
    supabase.from("profiles").select("id,nickname,streak_best,points_adjust,banned"),
    supabase.from("finds").select("user_id,found_at,points_awarded"),
    supabase.from("rocks").select("creator_id,created_at"),
    supabase.from("double_days").select("day,multiplier"),
  ]);
  if (profiles.error) throw new Error(profiles.error.message);

  const multipliers = new Map<string, number>();
  for (const row of (doubles.data ?? []) as Array<{ day: string; multiplier: number }>) {
    multipliers.set(row.day, row.multiplier);
  }
  const factor = (iso: string) => multipliers.get(iso.slice(0, 10)) ?? 1;

  const foundBy = new Map<string, number>();
  const foundPoints = new Map<string, number>();
  for (const row of (finds.data ?? []) as Array<{
    user_id: string;
    found_at: string;
    points_awarded: number | null;
  }>) {
    foundBy.set(row.user_id, (foundBy.get(row.user_id) ?? 0) + 1);
    foundPoints.set(
      row.user_id,
      (foundPoints.get(row.user_id) ?? 0) + (row.points_awarded ?? 10) * factor(row.found_at),
    );
  }
  const createdBy = new Map<string, number>();
  const createdPoints = new Map<string, number>();
  for (const row of (rocks.data ?? []) as Array<{ creator_id: string; created_at: string }>) {
    createdBy.set(row.creator_id, (createdBy.get(row.creator_id) ?? 0) + 1);
    createdPoints.set(
      row.creator_id,
      (createdPoints.get(row.creator_id) ?? 0) + 15 * factor(row.created_at),
    );
  }

  return (
    (profiles.data ?? []) as Array<{
      id: string;
      nickname: string;
      streak_best: number;
      points_adjust: number;
      banned: boolean;
    }>
  )
    .filter((p) => !p.banned)
    .map((p) => ({
      id: p.id,
      nickname: p.nickname,
      found: foundBy.get(p.id) ?? 0,
      created: createdBy.get(p.id) ?? 0,
      streak_best: p.streak_best,
      points: Math.max(
        0,
        (foundPoints.get(p.id) ?? 0) + (createdPoints.get(p.id) ?? 0) + (p.points_adjust ?? 0),
      ),
    }))
    .sort((a, b) => b.points - a.points || b.found - a.found);
}

export async function rateRock(rockId: string, userId: string, stars: number) {
  const { error } = await supabase
    .from("rock_ratings")
    .upsert({ rock_id: rockId, user_id: userId, stars }, { onConflict: "rock_id,user_id" });
  if (error) throw new Error(error.message);
}

export type FriendLocation = {
  id: string;
  nickname: string;
  lat: number;
  lng: number;
  updated_at: string | null;
};

/** Salva la mia posizione attuale sul mio profilo. */
export async function saveMyLocation(userId: string, lat: number, lng: number) {
  const { error } = await supabase
    .from("profiles")
    .update({ latitude: lat, longitude: lng, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

/** Posizioni degli amici che hanno condiviso il GPS. */
export async function fetchFriendLocations(userId: string): Promise<FriendLocation[]> {
  const links = await fetchLinks(userId);
  const ids = [
    ...new Set(
      links
        .filter((l) => l.status === "accepted")
        .map((l) => (l.user_id === userId ? l.friend_id : l.user_id)),
    ),
  ];
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nickname,latitude,longitude,updated_at")
    .in("id", ids)
    .not("latitude", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((f) => ({
    id: f.id,
    nickname: f.nickname,
    lat: f.latitude!,
    lng: f.longitude!,
    updated_at: f.updated_at,
  }));
}
