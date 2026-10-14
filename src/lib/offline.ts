export type PendingCreate = {
  kind: "create";
  id: string;
  payload: {
    name: string;
    clue: string;
    photo: string;
    lat: number;
    lng: number;
    difficulty: string;
  };
};

export type PendingMove = {
  kind: "move";
  id: string;
  payload: { rockId: string; clue: string; photo: string; lat: number; lng: number };
};

export type PendingFind = {
  kind: "find";
  id: string;
  payload: { rockId: string; photo: string; lat: number; lng: number };
};

export type PendingAction = PendingCreate | PendingMove | PendingFind;

const QUEUE_KEY = "rockdex.queue.v1";
const DRAFT_KEY = "rockdex.draft.v1";

export type RockDraft = {
  name: string;
  clue: string;
  difficulty: string;
  photo: string | null;
  lat: number | null;
  lng: number | null;
  savedAt: number;
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readQueue(): PendingAction[] {
  if (typeof window === "undefined") return [];
  return safeParse<PendingAction[]>(window.localStorage.getItem(QUEUE_KEY), []);
}

function writeQueue(items: PendingAction[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("rockdex-queue"));
}

export function enqueue(action: Omit<PendingAction, "id"> & { id?: string }) {
  const item = { ...action, id: action.id ?? `q-${Date.now()}-${Math.random().toString(36).slice(2)}` } as PendingAction;
  writeQueue([...readQueue(), item]);
  return item;
}

export function dequeue(id: string) {
  writeQueue(readQueue().filter((item) => item.id !== id));
}

export function readDraft(): RockDraft | null {
  if (typeof window === "undefined") return null;
  return safeParse<RockDraft | null>(window.localStorage.getItem(DRAFT_KEY), null);
}

export function saveDraft(draft: RockDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_KEY);
}
