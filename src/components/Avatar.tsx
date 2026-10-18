import { avatarGradient, initialOf } from "@/lib/pins";

/**
 * Avatar rotondo: la foto profilo se c'è, altrimenti l'iniziale del nickname su un gradiente
 * sempre uguale per la stessa persona.
 */
export function Avatar({
  name,
  src,
  className = "h-11 w-11 text-lg",
}: {
  name: string;
  src?: string | null | undefined;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className={`shrink-0 rounded-full bg-muted object-cover ${className}`}
      />
    );
  }
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
