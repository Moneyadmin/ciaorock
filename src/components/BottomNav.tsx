import { Link } from "@tanstack/react-router";

const items = [
  { to: "/", label: "Mappa", icon: "🗺️" },
  { to: "/crea", label: "Crea", icon: "🎨" },
  { to: "/collezione", label: "RockDex", icon: "📖" },
  { to: "/classifica", label: "Classifica", icon: "🏆" },
  { to: "/amici", label: "Amici", icon: "👥" },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[900] mx-auto w-full max-w-md border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="grid grid-cols-5">
        {items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
