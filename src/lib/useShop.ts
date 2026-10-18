import { useQuery } from "@tanstack/react-query";
import { fetchShopItems, type ShopItem } from "@/lib/api";

/** Articoli del negozio (cambiano di rado): servono anche per mostrare le targhette degli altri. */
export function useShopItems() {
  const query = useQuery({
    queryKey: ["shop-items"],
    queryFn: fetchShopItems,
    staleTime: 10 * 60_000,
  });
  const byId = new Map<string, ShopItem>((query.data ?? []).map((i) => [i.id, i]));
  return { items: query.data ?? [], byId, isLoading: query.isLoading };
}
