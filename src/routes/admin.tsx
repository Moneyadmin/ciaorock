import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RewardsAdmin } from "@/components/RewardsAdmin";
import { ADMIN_HOLD_MS } from "@/lib/rules";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/lib/useSession";
import {
  adminAdjustPoints,
  adminDeleteAnnouncement,
  adminListAnnouncements,
  adminSendAnnouncement,
  adminDeleteRock,
  adminListDoubleDays,
  adminListPlayers,
  adminListRocks,
  adminListTrash,
  adminListRockPoints,
  adminSetRockPoints,
  adminMoveRock,
  adminRemoveDoubleDay,
  adminRestoreRock,
  adminSetBanned,
  adminSetDoubleDay,
  unlockAdminPanel,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Pannello admin — RockDex" },
      {
        name: "description",
        content: "Pannello di controllo riservato: sassi, giocatori e giorni speciali.",
      },
      { property: "og:title", content: "Pannello admin — RockDex" },
      { property: "og:description", content: "Area riservata di RockDex." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Player = { id: string; nickname: string; points_adjust: number; banned: boolean };
type Rock = { id: string; name: string; lat: number; lng: number; move_count: number };
type Special = { id: string; day: string; multiplier: number };
type Trashed = { id: string; name: string; lat: number; lng: number; deleted_at: string };

const QUESTION = "lui ohp lui?";

function AdminPage() {
  const { loading, userId, admin } = useSession();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!loading && !userId) navigate({ to: "/auth" });
  }, [loading, userId, navigate]);

  if (loading) {
    return (
      <AppShell title="Pannello admin">
        <p className="pebble-card p-5 text-sm text-muted-foreground">Carico…</p>
      </AppShell>
    );
  }

  if (!admin) {
    return (
      <AppShell title="Pannello admin">
        <p className="pebble-card p-5 text-sm text-muted-foreground">
          Questa area è riservata. Il tuo account non ha i permessi.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Pannello admin" subtitle="Area riservata">
      {unlocked ? <AdminTools /> : <UnlockForm onUnlocked={() => setUnlocked(true)} />}
    </AppShell>
  );
}

function UnlockForm({ onUnlocked }: { onUnlocked: () => void }) {
  const unlock = useServerFn(unlockAdminPanel);
  const [step, setStep] = useState(1);
  const [one, setOne] = useState("");
  const [two, setTwo] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await unlock({ data: { passwordOne: one, passwordTwo: two, answer } });
      if (res.ok) {
        toast.success("Pannello sbloccato");
        onUnlocked();
      } else {
        toast.error("Sequenza errata. Riprova da capo.");
        setStep(1);
        setOne("");
        setTwo("");
        setAnswer("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pebble-card space-y-3 p-5">
      <p className="text-sm text-muted-foreground">Passaggio {step} di 3</p>
      {step === 1 && (
        <>
          <label className="block text-sm font-bold">Prima password</label>
          <input
            type="password"
            value={one}
            onChange={(e) => setOne(e.target.value)}
            className="w-full rounded-2xl border border-input bg-card px-4 py-3 outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
          />
          <button
            disabled={!one}
            onClick={() => setStep(2)}
            className="press w-full rounded-2xl bg-primary py-3.5 font-extrabold text-primary-foreground disabled:opacity-50"
          >
            Avanti
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <label className="block text-sm font-bold">Seconda password</label>
          <input
            type="password"
            value={two}
            onChange={(e) => setTwo(e.target.value)}
            className="w-full rounded-2xl border border-input bg-card px-4 py-3 outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
          />
          <button
            disabled={!two}
            onClick={() => setStep(3)}
            className="press w-full rounded-2xl bg-primary py-3.5 font-extrabold text-primary-foreground disabled:opacity-50"
          >
            Avanti
          </button>
        </>
      )}
      {step === 3 && (
        <>
          <label className="block text-sm font-bold">{QUESTION}</label>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full rounded-2xl border border-input bg-card px-4 py-3 outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
          />
          <button
            disabled={!answer || busy}
            onClick={submit}
            className="press w-full rounded-2xl bg-primary py-3.5 font-extrabold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Verifico…" : "Sblocca"}
          </button>
        </>
      )}
    </div>
  );
}

function AdminTools() {
  const listPlayers = useServerFn(adminListPlayers);
  const listRocks = useServerFn(adminListRocks);
  const listDays = useServerFn(adminListDoubleDays);
  const adjust = useServerFn(adminAdjustPoints);
  const setBanned = useServerFn(adminSetBanned);
  const moveRock = useServerFn(adminMoveRock);
  const deleteRock = useServerFn(adminDeleteRock);
  const setDay = useServerFn(adminSetDoubleDay);
  const removeDay = useServerFn(adminRemoveDoubleDay);
  const listTrash = useServerFn(adminListTrash);
  const restoreRock = useServerFn(adminRestoreRock);
  const listAnn = useServerFn(adminListAnnouncements);
  const sendAnn = useServerFn(adminSendAnnouncement);
  const delAnn = useServerFn(adminDeleteAnnouncement);

  const [players, setPlayers] = useState<Player[]>([]);
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [days, setDays] = useState<Special[]>([]);
  const [trash, setTrash] = useState<Trashed[]>([]);
  const [anns, setAnns] = useState<
    Array<{ id: string; title: string; body: string; created_at: string }>
  >([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [tab, setTab] = useState<
    "sassi" | "punti" | "giocatori" | "premi" | "giorni" | "avvisi" | "cestino"
  >("sassi");
  const [newDay, setNewDay] = useState("");
  const [newMult, setNewMult] = useState(2);

  async function reload() {
    try {
      const [p, r, d, t, a] = await Promise.all([
        listPlayers({}),
        listRocks({}),
        listDays({}),
        listTrash({}),
        listAnn({}),
      ]);
      setPlayers(p as Player[]);
      setRocks(r as Rock[]);
      setDays(d as Special[]);
      setTrash(t as Trashed[]);
      setAnns(a);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore di caricamento");
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="-mx-1 flex gap-0.5 overflow-x-auto rounded-2xl bg-muted p-1 text-sm font-extrabold">
        {(["sassi", "punti", "giocatori", "premi", "giorni", "avvisi", "cestino"] as const).map(
          (t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 grow rounded-xl px-2.5 py-2 text-xs capitalize ${
                tab === t ? "bg-ink text-ink-foreground shadow-pebble" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ),
        )}
      </div>

      {tab === "avvisi" && (
        <div className="space-y-3">
          <div className="pebble-card space-y-2 p-4">
            <p className="font-bold">Invia una notifica a tutti</p>
            <input
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="Titolo (es. Giornata speciale!)"
              className="w-full rounded-2xl border border-input bg-card px-4 py-3 outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
            />
            <textarea
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="Messaggio (es. Ciao, oggi ti regalo un X2 su tutti i punti)"
              rows={3}
              className="w-full rounded-2xl border border-input bg-card px-4 py-3 outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
            />
            <button
              disabled={!annTitle.trim() || !annBody.trim()}
              onClick={() =>
                run(async () => {
                  await sendAnn({ data: { title: annTitle, body: annBody } });
                  setAnnTitle("");
                  setAnnBody("");
                }, "Notifica inviata a tutti")
              }
              className="press w-full rounded-2xl bg-primary py-3.5 font-extrabold text-primary-foreground disabled:opacity-50"
            >
              Invia a tutti 📣
            </button>
          </div>
          {anns.map((a) => (
            <div key={a.id} className="pebble-card flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-bold">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.body}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("it-IT")}
                </p>
              </div>
              <button
                onClick={() => run(() => delAnn({ data: { id: a.id } }), "Notifica eliminata")}
                className="rounded-xl bg-muted px-3 py-2 text-xs font-bold"
              >
                Elimina
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "sassi" && (
        <p className="pebble-card p-4 text-xs text-muted-foreground">
          Sulla mappa puoi anche tenere premuto un sasso per {ADMIN_HOLD_MS / 1000} secondi: dopo la
          conferma tocchi il punto dove spostarlo (o esci senza spostarlo). I sassi eliminati
          finiscono nel cestino e sono ripristinabili.
        </p>
      )}

      {tab === "punti" && <RockPointsTable />}

      {tab === "premi" && <RewardsAdmin />}

      {tab === "cestino" &&
        (trash.length === 0 ? (
          <p className="pebble-card p-5 text-sm text-muted-foreground">Il cestino è vuoto.</p>
        ) : (
          trash.map((item) => (
            <div key={item.id} className="pebble-card flex items-center justify-between p-4">
              <div>
                <p className="font-bold">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  Eliminato il {new Date(item.deleted_at).toLocaleDateString("it-IT")}
                </p>
              </div>
              <button
                onClick={() =>
                  run(() => restoreRock({ data: { rockId: item.id } }), "Sasso ripristinato")
                }
                className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
              >
                Ripristina
              </button>
            </div>
          ))
        ))}

      {tab === "sassi" &&
        rocks.map((rock) => (
          <RockRowCard
            key={rock.id}
            rock={rock}
            onMove={(lat, lng) =>
              run(() => moveRock({ data: { rockId: rock.id, lat, lng } }), "Sasso spostato")
            }
            onDelete={() => run(() => deleteRock({ data: { rockId: rock.id } }), "Sasso eliminato")}
          />
        ))}

      {tab === "giocatori" &&
        players.map((player) => (
          <PlayerRowCard
            key={player.id}
            player={player}
            onAdjust={(delta) =>
              run(() => adjust({ data: { userId: player.id, delta } }), "Punti aggiornati")
            }
            onBan={() =>
              run(
                () => setBanned({ data: { userId: player.id, banned: !player.banned } }),
                player.banned ? "Giocatore sbloccato" : "Giocatore bannato",
              )
            }
          />
        ))}

      {tab === "giorni" && (
        <>
          <div className="pebble-card space-y-2 p-4">
            <p className="font-bold">Nuovo giorno speciale</p>
            <input
              type="date"
              value={newDay}
              onChange={(e) => setNewDay(e.target.value)}
              className="w-full rounded-2xl border border-input bg-card px-4 py-3 outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
            />
            <input
              type="number"
              min={2}
              value={newMult}
              onChange={(e) => setNewMult(Number(e.target.value))}
              className="w-full rounded-2xl border border-input bg-card px-4 py-3 outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
            />
            <button
              disabled={!newDay}
              onClick={() =>
                run(
                  () => setDay({ data: { day: newDay, multiplier: newMult } }),
                  "Giorno speciale salvato",
                )
              }
              className="press w-full rounded-2xl bg-primary py-3.5 font-extrabold text-primary-foreground disabled:opacity-50"
            >
              Attiva punti x{Math.max(2, newMult)}
            </button>
          </div>
          {days.map((day) => (
            <div key={day.id} className="pebble-card flex items-center justify-between p-4">
              <div>
                <p className="font-bold">{new Date(day.day).toLocaleDateString("it-IT")}</p>
                <p className="text-sm text-muted-foreground">Punti x{day.multiplier}</p>
              </div>
              <button
                onClick={() => run(() => removeDay({ data: { id: day.id } }), "Giorno rimosso")}
                className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-destructive"
              >
                Rimuovi
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function RockRowCard({
  rock,
  onMove,
  onDelete,
}: {
  rock: Rock;
  onMove: (lat: number, lng: number) => void;
  onDelete: () => void;
}) {
  const [lat, setLat] = useState(String(rock.lat));
  const [lng, setLng] = useState(String(rock.lng));

  return (
    <div className="pebble-card space-y-2 p-4">
      <p className="font-bold">{rock.name}</p>
      <p className="text-xs text-muted-foreground">Spostamenti: {rock.move_count}</p>
      <div className="flex gap-2">
        <input
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          aria-label="Latitudine"
        />
        <input
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          aria-label="Longitudine"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            const la = Number(lat);
            const ln = Number(lng);
            if (!Number.isFinite(la) || !Number.isFinite(ln)) {
              toast.error("Coordinate non valide");
              return;
            }
            onMove(la, ln);
          }}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
        >
          Sposta
        </button>
        <button
          onClick={onDelete}
          className="rounded-xl border border-border px-3 py-2.5 text-sm font-bold text-destructive"
        >
          Elimina
        </button>
      </div>
    </div>
  );
}

function PlayerRowCard({
  player,
  onAdjust,
  onBan,
}: {
  player: Player;
  onAdjust: (delta: number) => void;
  onBan: () => void;
}) {
  const [delta, setDelta] = useState("10");

  return (
    <div className="pebble-card space-y-2 p-4">
      <p className="font-bold">
        @{player.nickname} {player.banned && <span className="text-destructive">· bannato</span>}
      </p>
      <p className="text-xs text-muted-foreground">Correzione punti: {player.points_adjust}</p>
      <div className="flex gap-2">
        <input
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          aria-label="Punti da aggiungere o togliere"
        />
        <button
          onClick={() => onAdjust(Number(delta) || 0)}
          className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
        >
          Aggiungi
        </button>
        <button
          onClick={() => onAdjust(-(Number(delta) || 0))}
          className="rounded-xl border border-border px-3 py-2 text-sm font-bold"
        >
          Togli
        </button>
      </div>
      <button
        onClick={onBan}
        className={`w-full rounded-xl py-2.5 text-sm font-bold ${
          player.banned ? "border border-border" : "bg-destructive text-destructive-foreground"
        }`}
      >
        {player.banned ? "Sblocca giocatore" : "Banna giocatore"}
      </button>
    </div>
  );
}

function RockPointsTable() {
  const list = useServerFn(adminListRockPoints);
  const save = useServerFn(adminSetRockPoints);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminListRockPoints>>>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});

  async function load() {
    try {
      setRows(await list({}));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore di caricamento");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function apply(id: string, value: number | null) {
    try {
      await save({ data: { rockId: id, points: value } });
      toast.success(value === null ? "Punti tornati automatici" : "Punti aggiornati");
      setEdits((e) => ({ ...e, [id]: "" }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    }
  }

  return (
    <div className="pebble-card overflow-x-auto p-2">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-2">Sasso</th>
            <th className="p-2">Creatore</th>
            <th className="p-2">Punti</th>
            <th className="p-2">Voti</th>
            <th className="p-2">Manuale</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-middle">
              <td className="p-2 font-bold">{r.name}</td>
              <td className="p-2">{r.creator}</td>
              <td className="p-2">
                {r.points}
                <span className="block text-[10px] text-muted-foreground">
                  {r.points_override != null
                    ? "manuale"
                    : r.rating_count >= 2
                      ? "community"
                      : `IA · ${r.difficulty}`}
                </span>
              </td>
              <td className="p-2">
                {r.rating_avg != null ? `⭐ ${r.rating_avg.toFixed(1)} (${r.rating_count})` : "—"}
              </td>
              <td className="p-2">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={edits[r.id] ?? ""}
                    placeholder={String(r.points)}
                    onChange={(e) => setEdits((x) => ({ ...x, [r.id]: e.target.value }))}
                    className="w-20 rounded-lg border border-input bg-background px-2 py-1"
                  />
                  <button
                    type="button"
                    disabled={!edits[r.id]}
                    onClick={() => apply(r.id, Math.round(Number(edits[r.id])))}
                    className="rounded-lg bg-primary px-2 py-1 text-xs font-bold text-primary-foreground disabled:opacity-40"
                  >
                    Salva
                  </button>
                  {r.points_override != null && (
                    <button
                      type="button"
                      onClick={() => apply(r.id, null)}
                      className="rounded-lg bg-muted px-2 py-1 text-xs font-bold"
                    >
                      Auto
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
