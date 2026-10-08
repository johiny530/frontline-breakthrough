// Two UI languages: Traditional Chinese and English.
// The choice is remembered per browser; the first visit follows the browser language.

export type Lang = 'zh' | 'en';

const KEY = 'frontline-breakthrough.lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch { /* storage blocked: fall back to the browser language */ }
  return /^zh/i.test(navigator.language) ? 'zh' : 'en';
}

// Headless runs (tests, simulator) have no browser: default to Chinese.
export let lang: Lang = typeof window === 'undefined' ? 'zh' : detect();

export function setLang(next: Lang): void {
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* not persisted */ }
  document.documentElement.lang = next === 'zh' ? 'zh-Hant' : 'en';
}

/** Picks the string for the current language. */
export const t = (zh: string, en: string): string => (lang === 'zh' ? zh : en);
