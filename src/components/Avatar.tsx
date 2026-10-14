import { avatarGradient, initialOf } from "@/lib/pins";

/** Avatar rotondo con l'iniziale del nickname su un gradiente sempre uguale per la stessa persona. */
export function Avatar({
  name,
  className = "h-11 w-11 text-lg",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-display text-white ${className}`}
      style={{ background: avatarGradient(name) }}
    >
      {initialOf(name)}
    </span>
  );
}
