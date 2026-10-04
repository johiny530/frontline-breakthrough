const KEY = 'frontline-breakthrough.save.v1';

export interface EndlessRecord {
  sector: number; // most sectors cleared in one run
  score: number; // best run score
}

export interface SaveData {
  best: number[]; // best score per stage, 0 = never cleared
  unlocked: number; // number of playable stages
  medals: number; // endless-mode currency
  meta: Record<string, number>; // permanent upgrade levels by id
  endless: EndlessRecord;
}

export function loadSave(stageCount: number): SaveData {
  const fresh: SaveData = {
    best: new Array(stageCount).fill(0),
    unlocked: 1,
    medals: 0,
    meta: {},
    endless: { sector: 0, score: 0 },
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    // Older saves lack the endless fields; fill them with defaults.
    const data = JSON.parse(raw) as Partial<SaveData>;
    const best = fresh.best.map((_, i) => Number(data.best?.[i]) || 0);
    const unlocked = Math.min(stageCount, Math.max(1, Number(data.unlocked) || 1));
    const meta: Record<string, number> = {};
    for (const [k, v] of Object.entries(data.meta ?? {})) meta[k] = Math.max(0, Number(v) || 0);
    return {
      best,
      unlocked,
      medals: Math.max(0, Number(data.medals) || 0),
      meta,
      endless: { sector: Number(data.endless?.sector) || 0, score: Number(data.endless?.score) || 0 },
    };
  } catch {
    return fresh;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage may be unavailable (private mode); progress just won't persist.
  }
}

/** Endless mode opens once the last campaign stage has been cleared. */
export const endlessUnlocked = (save: SaveData): boolean => save.best[save.best.length - 1] > 0;
