import { Crown } from "lucide-react";

/** Targhetta del negozio: scritta con contorno dorato, mostrata sotto il nickname. */
export function Plate({
  label,
  style = "gold",
  size = "sm",
}: {
  label: string | null | undefined;
  style?: string | null | undefined;
  size?: "sm" | "md";
}) {
  if (!label) return null;
  const shine = style === "gold-shine";
  return (
    <span
      className={`plate inline-flex max-w-full items-center gap-1 rounded-full font-extrabold ${
        shine ? "plate-shine" : ""
      } ${size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"}`}
    >
      <Crown
        className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"}
        fill="currentColor"
        strokeWidth={1.5}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
