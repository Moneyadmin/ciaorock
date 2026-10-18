/** Logo di Ciao Rock: lo stesso disegno dell'icona dell'app (public/logo.svg). */
export function Logo({ className = "h-20 w-20" }: { className?: string }) {
  return <img src="/logo.svg?v=2" alt="Ciao Rock" className={className} draggable={false} />;
}
