import { Crown } from "lucide-react";

/** Colori disponibili per le targhette; "-shine" aggiunge il riflesso animato. */
export const PLATE_STYLES = [
  { id: "gold", label: "Oro" },
  { id: "gold-shine", label: "Oro brillante" },
  { id: "silver", label: "Argento" },
  { id: "silver-shine", label: "Argento brillante" },
  { id: "violet", label: "Viola" },
  { id: "violet-shine", label: "Viola brillante" },
] as const;

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
  const shine = style?.endsWith("-shine") ?? false;
  const tone = style?.startsWith("silver")
    ? "plate-silver"
    : style?.startsWith("violet")
      ? "plate-violet"
      : "";
  return (
    <span
      className={`plate inline-flex max-w-full items-center gap-1 rounded-full font-extrabold ${
        shine ? "plate-shine" : ""
      } ${tone} ${size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"}`}
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
