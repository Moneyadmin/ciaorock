import { scoreRock } from "@/lib/points.functions";
import { claimFindFn, createRockFn, moveRockFn, type GameResult } from "@/lib/game.functions";
import { dequeue, readQueue, type PendingAction } from "@/lib/offline";

export type FlushResult = { synced: number; rejected: number };

/**
 * Invia al server le azioni salvate offline. Il server controlla foto (AI), distanza e
 * permessi: se rifiuta un'azione la scartiamo, se c'è un errore di rete riproviamo dopo.
 */
export async function flushQueue(userId: string | null): Promise<FlushResult> {
  if (typeof window === "undefined" || !navigator.onLine || !userId) {
    return { synced: 0, rejected: 0 };
  }
  let synced = 0;
  let rejected = 0;

  for (const action of readQueue()) {
    try {
      const result = await runAction(action);
      dequeue(action.id);
      if (result.ok) synced += 1;
      else rejected += 1;
    } catch {
      break; // keep the rest queued, retry later
    }
  }
  return { synced, rejected };
}

async function runAction(action: PendingAction): Promise<GameResult> {
  if (action.kind === "create") {
    const result = await createRockFn({ data: action.payload });
    if (result.ok && result.id) {
      await scoreRock({ data: { rockId: result.id } }).catch(() => undefined);
    }
    return result;
  }
  if (action.kind === "move") {
    const { fromLat, fromLng, ...rest } = action.payload;
    // Le code salvate da versioni precedenti non hanno la posizione di partenza.
    if (fromLat == null || fromLng == null) {
      return { ok: false, message: "Spostamento offline non più valido." };
    }
    return moveRockFn({ data: { ...rest, fromLat, fromLng } });
  }
  return claimFindFn({ data: action.payload });
}
