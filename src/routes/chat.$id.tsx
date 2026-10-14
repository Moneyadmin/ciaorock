import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Loader2, SendHorizontal, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
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
      <Link
        to="/messaggi"
        className="press inline-flex items-center gap-1 rounded-full bg-muted py-1.5 pl-2 pr-3.5 text-sm font-extrabold text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={3} /> Messaggi
      </Link>
      <div className="mt-4 space-y-1.5 pb-40">
        {messages.length === 0 && (
          <div className="flex flex-col items-center py-10 text-center">
            {other && <Avatar name={other.nickname} className="h-16 w-16 text-3xl shadow-lift" />}
            <p className="mt-3 text-sm font-semibold text-muted-foreground">
              Nessun messaggio. Scrivi il primo!
            </p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-[1.3rem] px-3.5 py-2.5 text-[15px] ${
                  mine
                    ? "bg-brand rounded-br-md text-white shadow-pebble"
                    : "rounded-bl-md bg-card text-foreground shadow-pebble ring-1 ring-border"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div className="mt-1 flex items-center justify-between gap-3 text-[10px] font-semibold opacity-70">
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
                      className="press inline-flex items-center gap-0.5 font-bold"
                    >
                      <Trash2 className="h-3 w-3" /> Elimina
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
        className="fixed inset-x-0 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-[850] mx-auto flex max-w-md gap-2 px-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Scrivi un messaggio…"
          aria-label="Messaggio"
          className="glass flex-1 rounded-full px-5 py-3.5 text-base outline-none focus:ring-4 focus:ring-ring/20"
        />
        <button
          disabled={sending || !text.trim()}
          aria-label="Invia"
          className="press bg-brand grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-full text-white shadow-glow disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <SendHorizontal className="h-5 w-5" />
          )}
        </button>
      </form>
    </AppShell>
  );
}
