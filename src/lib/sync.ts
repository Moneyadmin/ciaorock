import { scoreRock } from "@/lib/points.functions";
import { createRock, fetchRockMoveCount, fetchRockPhoto, moveRock, registerFind } from "@/lib/api";
import { lookupPlace } from "@/lib/geo.functions";
import { matchRockPhoto, verifyRockPhoto } from "@/lib/vision.functions";
import { dequeue, readQueue, type PendingAction } from "@/lib/offline";

export type FlushResult = { synced: number; rejected: number };

/** Push queued offline actions to the backend; photos are AI-checked first. */
export async function flushQueue(userId: string | null): Promise<FlushResult> {
  if (typeof window === "undefined" || !navigator.onLine || !userId) {
    return { synced: 0, rejected: 0 };
  }
  let synced = 0;
  let rejected = 0;

  for (const action of readQueue()) {
    try {
      const check = await checkActionPhoto(action);
      if (!check.approved) {
        dequeue(action.id);
        rejected += 1;
        continue;
      }
      await runAction(action, userId);
      dequeue(action.id);
      synced += 1;
    } catch {
      break; // keep the rest queued, retry later
    }
  }
  return { synced, rejected };
}

/** Finds/moves are compared with the rock's original photo; creations are only checked for paint. */
async function checkActionPhoto(action: PendingAction) {
  if (action.kind !== "create") {
    const reference = await fetchRockPhoto(action.payload.rockId).catch(() => null);
    if (reference) {
      return matchRockPhoto({ data: { photo: action.payload.photo, reference } });
    }
  }
  return verifyRockPhoto({ data: { photo: action.payload.photo } });
}

async function runAction(action: PendingAction, userId: string) {
  if (action.kind === "create") {
    const id = await createRock(action.payload);
    await scoreRock({ data: { rockId: id } }).catch(() => undefined);
    return;
  }
  if (action.kind === "move") {
    const moveCount = await fetchRockMoveCount(action.payload.rockId);
    await moveRock({ ...action.payload, userId, moveCount });
    return;
  }
  const place = await lookupPlace({
    data: { lat: action.payload.lat, lng: action.payload.lng },
  }).catch(() => ({ city: null, region: null, country: null, continent: null }));
  await registerFind({
    rockId: action.payload.rockId,
    photo: action.payload.photo,
    lat: action.payload.lat,
    lng: action.payload.lng,
    place,
  });
}
