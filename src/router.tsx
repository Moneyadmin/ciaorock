import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Dati non urgenti: si riusano per 2 minuti e non si riscaricano a ogni ritorno sulla scheda
  // (meno banda consumata su Supabase).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 120_000, refetchOnWindowFocus: false } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
