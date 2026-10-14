import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteMessage,
  fetchConversation,
  fetchProfileById,
  sendMessage,
  type MessageRow,
  type ProfileRow,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

export const Route = createFileRoute("/chat/$id")({
  head: () => ({
    meta: [
      { title: "Chat — RockDex" },
      { name: "description", content: "Chatta in tempo reale con gli altri cercatori di sassi." },
      { property: "og:title", content: "Chat — RockDex" },
      { property: "og:description", content: "Messaggi privati in tempo reale tra cercatori." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { id } = Route.useParams();
  const { loading, userId } = useSession();
  const navigate = useNavigate();
  const [other, setOther] = useState<ProfileRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !userId) navigate({ to: "/auth" });
  }, [loading, userId, navigate]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const reload = () =>
      fetchConversation(userId, id)
        .then((list) => alive && setMessages(list))
        .catch(() => {});
    void fetchProfileById(id).then((p) => alive && setOther(p));
    void reload();
    const channel = supabase
      .channel(`chat-${userId}-${id}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void reload();
      })
      .subscribe();
    // Rete di sicurezza: se il tempo reale cade, ricarica ogni 4 secondi.
    const poll = window.setInterval(reload, 4000);
    return () => {
      alive = false;
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [userId, id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || !userId) return;
    setSending(true);
    try {
      await sendMessage(id, body);
      setText("");
      setMessages(await fetchConversation(userId, id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Messaggio non inviato");
    } finally {
      setSending(false);
    }
  }

  async function remove(m: MessageRow) {
    if (!confirm("Eliminare questo messaggio?")) return;
    try {
      await deleteMessage(m.id);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
      toast.success("Messaggio eliminato");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossibile eliminare");
    }
  }

  return (
    <AppShell title={other ? `@${other.nickname}` : "Chat"} subtitle="Messaggi in tempo reale">
      <Link to="/messaggi" className="text-sm font-bold text-primary">
        ← Messaggi
      </Link>
      <div className="mt-3 space-y-2 pb-44">
        {messages.length === 0 && (
          <p className="pebble-card p-4 text-sm text-muted-foreground">
            Nessun messaggio. Scrivi il primo! 👋
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div className="mt-0.5 flex items-center justify-between gap-3 text-[10px] opacity-70">
                  <span>
                    {new Date(m.created_at).toLocaleTimeString("it-IT", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {mine && (
                    <button
                      type="button"
                      onClick={() => void remove(m)}
                      aria-label="Elimina messaggio"
                      className="font-bold underline"
                    >
                      🗑️ Elimina
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="fixed inset-x-0 bottom-20 z-[850] mx-auto flex max-w-md gap-2 border-t border-border bg-background px-4 py-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Scrivi un messaggio…"
          className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 outline-none focus:border-ring"
        />
        <button
          disabled={sending || !text.trim()}
          className="rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50"
        >
          Invia
        </button>
      </form>
    </AppShell>
  );
}
