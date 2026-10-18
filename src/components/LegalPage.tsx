import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

/** Impaginazione delle pagine legali: leggibili anche senza aver fatto l'accesso. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (history.length > 1 ? history.back() : (location.href = "/"))}
            className="press inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-sm font-extrabold"
          >
            <ArrowLeft className="h-4 w-4" /> Indietro
          </button>
          <Logo className="h-10 w-10" />
        </div>
        <h1 className="mt-6 text-4xl leading-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ultimo aggiornamento: {updated}</p>
        <div className="legal mt-6 space-y-4 text-[15px] leading-relaxed">{children}</div>
        <p className="mt-10 text-sm text-muted-foreground">
          <Link to="/privacy" className="font-bold underline">
            Informativa privacy
          </Link>{" "}
          ·{" "}
          <Link to="/termini" className="font-bold underline">
            Termini d'uso
          </Link>
        </p>
      </div>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-4 text-2xl leading-tight">{children}</h2>;
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}
