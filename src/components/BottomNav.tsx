import { Link } from "@tanstack/react-router";
import { BookOpen, Map, Plus, Trophy, Users, type LucideIcon } from "lucide-react";

type Item = { to: "/" | "/collezione" | "/classifica" | "/amici"; label: string; icon: LucideIcon };

const left: Item[] = [
  { to: "/", label: "Mappa", icon: Map },
  { to: "/collezione", label: "RockDex", icon: BookOpen },
];
const right: Item[] = [
  { to: "/classifica", label: "Classifica", icon: Trophy },
  { to: "/amici", label: "Amici", icon: Users },
];

function NavItem({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        to={item.to}
        activeOptions={{ exact: item.to === "/" }}
        className="group flex flex-col items-center gap-1 py-2 text-[10px] font-bold text-white/55 transition-colors"
        activeProps={{ className: "is-active !text-white" }}
      >
        <span className="grid h-8 w-12 place-items-center rounded-full transition-colors group-[.is-active]:bg-lime group-[.is-active]:text-ink">
          <Icon className="h-[19px] w-[19px]" strokeWidth={2.4} />
        </span>
        {item.label}
      </Link>
    </li>
  );
}

export function BottomNav() {
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-[900] mx-auto w-full max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul className="grid grid-cols-5 items-end rounded-[1.75rem] bg-ink/95 px-1 shadow-lift backdrop-blur-xl">
        {left.map((item) => (
          <NavItem key={item.to} item={item} />
        ))}
        <li className="flex justify-center">
          <Link
            to="/crea"
            aria-label="Crea un sasso"
            className="press group -mt-6 mb-2 flex flex-col items-center gap-1 text-[10px] font-bold text-white/55"
            activeProps={{ className: "is-active !text-white" }}
          >
            <span className="bg-brand grid h-14 w-14 place-items-center rounded-[1.25rem] text-white shadow-glow ring-4 ring-background transition-transform group-[.is-active]:rotate-45">
              <Plus className="h-7 w-7" strokeWidth={3} />
            </span>
            Crea
          </Link>
        </li>
        {right.map((item) => (
          <NavItem key={item.to} item={item} />
        ))}
      </ul>
    </nav>
  );
}
