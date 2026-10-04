const KEY = 'frontline-breakthrough.save.v1';

export interface SaveData {
  best: number[]; // best score per stage, 0 = never cleared
  unlocked: number; // number of playable stages
}

export function loadSave(stageCount: number): SaveData {
  const fresh: SaveData = { best: new Array(stageCount).fill(0), unlocked: 1 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const data = JSON.parse(raw) as Partial<SaveData>;
    const best = fresh.best.map((_, i) => Number(data.best?.[i]) || 0);
    const unlocked = Math.min(stageCount, Math.max(1, Number(data.unlocked) || 1));
    return { best, unlocked };
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
