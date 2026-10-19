import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronRight, Coins, Loader2, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Plate } from "@/components/Plate";
import { equipPlate, fetchMyPurchases, fetchWallet, sanitizeBio } from "@/lib/api";
import { removeAvatar, saveBio as saveBioServer, uploadAvatar } from "@/lib/profile.functions";
import { DeleteAccount } from "@/components/DeleteAccount";
import { squareAvatar } from "@/lib/rockdex";
import { useSession } from "@/lib/useSession";
import { useShopItems } from "@/lib/useShop";

export const Route = createFileRoute("/profilo")({
  head: () => ({ meta: [{ title: "Il mio profilo — Ciao Rock" }] }),
  component: ProfilePage,
});

const BIO_MAX = 500;

function ProfilePage() {
  const { loading, userId, profile, refresh } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const upload = useServerFn(uploadAvatar);
  const remove = useServerFn(removeAvatar);
  const saveBioFn = useServerFn(saveBioServer);
  const { byId } = useShopItems();
  const [bio, setBio] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!userId || !profile)) navigate({ to: "/auth" });
  }, [loading, userId, profile, navigate]);

  useEffect(() => {
    if (profile) setBio(profile.bio ?? "");
  }, [profile]);

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

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith("image/")) return setPhotoError("Scegli un'immagine.");
    setPhotoBusy(true);
    try {
      const photo = await squareAvatar(file);
      const res = await upload({ data: { photo } });
      if (!res.ok) return setPhotoError(res.message);
      await refresh();
      toast.success("Foto profilo aggiornata!");
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Caricamento non riuscito.");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function dropPhoto() {
    setPhotoBusy(true);
    try {
      await remove();
      await refresh();
    } finally {
      setPhotoBusy(false);
    }
  }

  async function saveBio() {
    if (!userId) return;
    setSavingBio(true);
    try {
      const res = await saveBioFn({ data: { bio } });
      if (!res.ok) return void toast.error(res.message);
      setBio(sanitizeBio(bio));
      await refresh();
      toast.success("Bio salvata");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bio non salvata");
    } finally {
      setSavingBio(false);
    }
  }

  async function wear(itemId: string | null) {
    try {
      await equipPlate(itemId);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Non riuscito");
    }
  }

  if (!profile) return <AppShell title="Il mio profilo">{null}</AppShell>;
  const plate = profile.plate_id ? byId.get(profile.plate_id) : null;
  const myPlates = (owned.data ?? [])
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => p != null && p.kind === "plate");

  return (
    <AppShell title="Il mio profilo" subtitle={`@${profile.nickname}`}>
      <section className="pebble-card flex flex-col items-center rounded-[1.75rem] p-5 text-center">
        <div className="relative">
          <Avatar
            name={profile.nickname}
            src={profile.avatar_url}
            className="h-28 w-28 text-5xl shadow-lift ring-4 ring-secondary"
          />
          <button
            type="button"
            disabled={photoBusy}
            onClick={() => fileRef.current?.click()}
            aria-label="Cambia foto profilo"
            className="press bg-brand absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full text-white shadow-glow ring-4 ring-card"
          >
            {photoBusy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </button>
        </div>
        {/* niente capture: dal telefono si può scegliere anche dal rullino */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void pickPhoto(e.target.files?.[0])}
        />
        <h2 className="mt-4 text-2xl">@{profile.nickname}</h2>
        {plate && (
          <div className="mt-1.5">
            <Plate label={plate.label} style={plate.style} size="md" />
          </div>
        )}
        {photoBusy && (
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            Controllo e carico la foto…
          </p>
        )}
        {photoError && (
          <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            {photoError}
          </p>
        )}
        {profile.avatar_url && !photoBusy && (
          <button
            type="button"
            onClick={() => void dropPhoto()}
            className="press mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-muted-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" /> Togli la foto
          </button>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Le foto vengono controllate prima di essere pubblicate. Niente dati personali (indirizzo,
          scuola, numero di telefono).
        </p>
      </section>

      <section className="pebble-card mt-4 space-y-3 rounded-[1.6rem] p-4">
        <h2 className="text-lg">La mia bio</h2>
        <textarea
          value={bio}
          maxLength={BIO_MAX}
          rows={4}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Racconta qualcosa di te: che sassi dipingi, dove ti piace cercarli…"
          className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted-foreground">
            {bio.length}/{BIO_MAX}
          </span>
          <button
            type="button"
            disabled={savingBio || sanitizeBio(bio) === (profile.bio ?? "")}
            onClick={() => void saveBio()}
            className="press rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
          >
            {savingBio ? "Salvo…" : "Salva"}
          </button>
        </div>
      </section>

      <Link
        to="/negozio"
        className="press bg-brand mt-4 flex items-center gap-3 rounded-[1.6rem] p-4 text-white shadow-glow"
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20">
          <Coins className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-white/75">
            Saldo
          </span>
          <span className="font-display text-2xl leading-none">
            {wallet.data ? wallet.data.balance.toLocaleString("it-IT") : "…"} punti
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-extrabold">
          <ShoppingBag className="h-4 w-4" /> Negozio <ChevronRight className="h-4 w-4" />
        </span>
      </Link>
      {wallet.data && (
        <p className="mt-2 px-2 text-xs text-muted-foreground">
          Guadagnati {wallet.data.earned.toLocaleString("it-IT")} · spesi{" "}
          {wallet.data.spent.toLocaleString("it-IT")}. Spendere nel negozio non ti fa scendere in
          classifica.
        </p>
      )}

      <section className="mt-5">
        <h2 className="text-xl">Le mie targhette</h2>
        {myPlates.length === 0 ? (
          <p className="pebble-card mt-2 p-4 text-sm text-muted-foreground">
            Non hai ancora targhette: le trovi nel negozio.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {myPlates.map((item) => {
              const on = profile.plate_id === item.id;
              return (
                <div
                  key={item.id}
                  className="pebble-card flex items-center justify-between gap-3 rounded-[1.3rem] p-3"
                >
                  <Plate label={item.label} style={item.style} size="md" />
                  <button
                    type="button"
                    onClick={() => void wear(on ? null : item.id)}
                    className={`press rounded-xl px-3 py-2 text-xs font-extrabold ${
                      on ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {on ? "Togli" : "Indossa"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section className="mt-8 space-y-2 pb-6">
        <h2 className="text-lg">Regole e privacy</h2>
        <p className="text-xs text-muted-foreground">
          <Link to="/come-si-gioca" className="font-bold underline">
            Come si gioca
          </Link>
          {" · "}Leggi l'
          <Link to="/privacy" className="font-bold underline">
            informativa privacy
          </Link>{" "}
          e i{" "}
          <Link to="/termini" className="font-bold underline">
            termini d'uso
          </Link>
          .
        </p>
        <DeleteAccount />
      </section>
    </AppShell>
  );
}
