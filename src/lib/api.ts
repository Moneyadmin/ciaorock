import { supabase } from "@/integrations/supabase/client";
import type { FindRecord } from "@/lib/badges";
import { claimFindFn, createRockFn, moveRockFn, type GameResult } from "@/lib/game.functions";

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
  avatar_url?: string | null;
  plate_id?: string | null;
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

const PROFILE_COLS = "id,nickname,bio,streak_current,streak_best,avatar_url,plate_id";

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

/** Esito di un'azione di gioco: lancia un errore leggibile se il server la rifiuta. */
function unwrap(result: GameResult) {
  if (!result.ok) throw new Error(result.message);
  return result;
}

/** Nuovo sasso: il server controlla la foto (o il gettone dell'AI) e lo registra. */
export async function createRock(input: {
  name: string;
  clue: string;
  photo: string;
  lat: number;
  lng: number;
  difficulty: string;
  fromLat?: number | undefined;
  fromLng?: number | undefined;
  token?: string | undefined;
}) {
  const result = unwrap(await createRockFn({ data: input }));
  return result.id as string;
}

/** Sposta un sasso: serve averlo trovato (o averlo creato) ed essere vicino al sasso. */
export async function moveRock(input: {
  rockId: string;
  clue: string;
  photo: string;
  lat: number;
  lng: number;
  fromLat: number;
  fromLng: number;
  token?: string | undefined;
}) {
  unwrap(await moveRockFn({ data: input }));
}

/** Registra un ritrovamento: il server controlla distanza e foto-prova. */
export async function registerFind(input: {
  rockId: string;
  photo: string;
  lat: number;
  lng: number;
  token?: string | undefined;
}) {
  unwrap(await claimFindFn({ data: input }));
}

export async function searchProfiles(query: string): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .ilike("nickname", `%${query}%`)
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileRow[];
}

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
  avatar_url: string | null;
  plate_label: string | null;
  plate_style: string | null;
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
    .select(PROFILE_COLS)
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
    .select(PROFILE_COLS)
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

/**
 * Classifica calcolata dal database: punti dei sassi trovati (con le giornate speciali), 15 per
 * ogni sasso creato, bonus (giornaliero, creatore, co-op) e correzioni dello staff. Gli acquisti
 * nel negozio non la abbassano.
 */
export async function fetchLeaderboard(): Promise<LeaderRow[]> {
  const { data, error } = await supabase.rpc("leaderboard");
  if (error) throw new Error(error.message);
  return [...(data ?? [])].sort((a, b) => b.points - a.points || b.found - a.found);
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

/** Salva la mia posizione attuale (visibile solo ai miei amici). */
export async function saveMyLocation(userId: string, lat: number, lng: number) {
  const { error } = await supabase
    .from("player_locations")
    .upsert({ user_id: userId, lat, lng }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

/** Posizioni degli amici che hanno condiviso il GPS (il database mostra solo quelle degli amici). */
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
  const [{ data: spots, error }, profs] = await Promise.all([
    supabase.from("player_locations").select("user_id,lat,lng,updated_at").in("user_id", ids),
    profilesByIds(ids),
  ]);
  if (error) throw new Error(error.message);
  const names = new Map(profs.map((p) => [p.id, p.nickname]));
  return (spots ?? [])
    .filter((s) => names.has(s.user_id))
    .map((s) => ({
      id: s.user_id,
      nickname: names.get(s.user_id)!,
      lat: s.lat,
      lng: s.lng,
      updated_at: s.updated_at,
    }));
}

// ---------------------------------------------------------------------------
// Profilo, negozio e missioni co-op
// ---------------------------------------------------------------------------

/** Toglie tag HTML e caratteri di controllo; massimo 500 caratteri (lo rifà anche il database). */
export function sanitizeBio(text: string) {
  return (
    text
      .replace(/<[^>]*>/g, "")
      // eslint-disable-next-line no-control-regex -- togliere i caratteri di controllo è proprio lo scopo
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .slice(0, 500)
      .trim()
  );
}

export async function updateBio(userId: string, bio: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ bio: sanitizeBio(bio) })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export type Wallet = { earned: number; spent: number; balance: number };

export async function fetchWallet(): Promise<Wallet> {
  const { data, error } = await supabase.rpc("my_wallet");
  if (error) throw new Error(error.message);
  return data?.[0] ?? { earned: 0, spent: 0, balance: 0 };
}

export type UnlockRule = {
  type: "finds" | "creates" | "points" | "streak" | "coop" | "rock" | "city";
  n: number;
  ref?: string;
};

/** Badge e targhette (anche creati dall'admin). price null = non si compra; unlock = condizione. */
export type ShopItem = {
  id: string;
  kind: "plate" | "badge";
  label: string;
  description: string;
  icon: string;
  price: number | null;
  style: string;
  unlock: UnlockRule | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  sort: number;
};

const SHOP_COLUMNS =
  "id,kind,label,description,icon,price,style,unlock,starts_at,ends_at,active,sort";

/** Tutto il catalogo, anche i premi scaduti o disattivati: servono a mostrare quelli posseduti. */
export async function fetchShopItems(): Promise<ShopItem[]> {
  const { data, error } = await supabase.from("shop_items").select(SHOP_COLUMNS).order("sort");
  if (!error) return (data ?? []) as unknown as ShopItem[];
  // database non ancora aggiornato (migrazione premi_admin): solo le targhette di prima
  const old = await supabase
    .from("shop_items")
    .select("id,label,description,price,style,active,sort")
    .order("sort");
  if (old.error) throw new Error(error.message);
  return (old.data ?? []).map((i) => ({
    ...i,
    kind: "plate" as const,
    icon: "🏅",
    unlock: null,
    starts_at: null,
    ends_at: null,
  }));
}

export type ShopItemInput = Omit<ShopItem, "sort"> & { sort?: number };

/** Solo admin (lo verifica il database). */
export async function saveShopItem(item: ShopItemInput) {
  const { error } = await supabase.from("shop_items").upsert(item as never);
  if (error) throw rpcError(error);
}

export async function deleteShopItem(id: string) {
  const { error } = await supabase.from("shop_items").delete().eq("id", id);
  if (error) throw rpcError(error);
}

export type RewardUnlocked = {
  id: string;
  kind: string;
  label: string;
  icon: string;
  style: string;
};

/** Assegna i premi a condizione raggiunti e restituisce quelli non ancora annunciati. */
export async function claimRewards(): Promise<RewardUnlocked[]> {
  const { data, error } = await supabase.rpc("claim_rewards");
  if (error) throw rpcError(error);
  return data ?? [];
}

export async function fetchRewardProgress(): Promise<
  Map<string, { progress: number; goal: number }>
> {
  const { data, error } = await supabase.rpc("my_reward_progress");
  if (error) throw rpcError(error);
  return new Map((data ?? []).map((r) => [r.item_id, { progress: r.progress, goal: r.goal }]));
}

/** Badge speciali (creati dall'admin) di un giocatore qualsiasi. */
export async function fetchSpecialBadges(userId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("user_special_badges", { _uid: userId });
  if (error) throw rpcError(error);
  return (data ?? []).map((r) => r.item_id);
}

export async function fetchMyPurchases(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("purchases").select("item_id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => p.item_id);
}

/** Errori leggibili dalle funzioni del database (il messaggio è già in italiano). */
function rpcError(error: { message: string }) {
  return new Error(error.message.replace(/^.*?ERROR:\s*/, ""));
}

export async function buyItem(itemId: string) {
  const { data, error } = await supabase.rpc("buy_item", { _item: itemId });
  if (error) throw rpcError(error);
  return data;
}

export async function equipPlate(itemId: string | null) {
  const { error } = await supabase.rpc("equip_plate", { _item: itemId });
  if (error) throw rpcError(error);
}

export type CoopMission = {
  id: string;
  creator_id: string;
  partner_id: string;
  rock_id: string;
  status: "pending" | "active" | "success" | "failed" | "declined" | "cancelled";
  created_at: string;
  accepted_at: string | null;
  expires_at: string;
  completed_at: string | null;
  creator_found_at: string | null;
  partner_found_at: string | null;
  creator_bonus: number | null;
  partner_bonus: number | null;
  rock: { id: string; name: string; lat: number; lng: number } | null;
};

/** Missioni in corso o concluse nell'ultima ora (per mostrare l'esito). */
export async function fetchMyMissions(userId: string): Promise<CoopMission[]> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { data, error } = await supabase
    .from("coop_missions")
    .select("*, rock:rocks(id,name,lat,lng)")
    .or(`creator_id.eq.${userId},partner_id.eq.${userId}`)
    .or(`status.in.(pending,active),completed_at.gte.${since}`)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CoopMission[];
}

export async function coopInvite(partnerId: string, rockId: string) {
  const { data, error } = await supabase.rpc("coop_invite", { _partner: partnerId, _rock: rockId });
  if (error) throw rpcError(error);
  return data;
}

export async function coopRespond(missionId: string, accept: boolean) {
  const { data, error } = await supabase.rpc("coop_respond", {
    _mission: missionId,
    _accept: accept,
  });
  if (error) throw rpcError(error);
  return data;
}

export async function coopCancel(missionId: string) {
  const { error } = await supabase.rpc("coop_cancel", { _mission: missionId });
  if (error) throw rpcError(error);
}
