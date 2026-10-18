/** Badge speciale (creato dall'admin): icona in un cerchio colorato con il nome sotto. */
export function SpecialBadge({
  icon,
  label,
  locked = false,
  size = "md",
}: {
  icon: string;
  label: string;
  locked?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        className={`grid shrink-0 place-items-center rounded-2xl ${
          locked ? "bg-muted grayscale" : "bg-brand shadow-glow"
        } ${size === "md" ? "h-12 w-12 text-2xl" : "h-8 w-8 text-base"}`}
      >
        <span className={locked ? "opacity-40" : ""}>{icon}</span>
      </span>
      <span
        className={`truncate font-extrabold ${size === "md" ? "text-base" : "text-xs"} ${
          locked ? "text-muted-foreground" : ""
        }`}
      >
        {label}
      </span>
    </span>
  );
}
