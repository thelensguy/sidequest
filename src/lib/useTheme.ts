import { useEffect, useState } from 'react';
import { getThemePreference, setThemePreference } from './storage';
import type { ThemePreference } from './types';

/**
 * localStorage mirror of the chrome.storage preference, purely to kill the
 * flash-of-dark-theme on load for light-theme users: chrome.storage reads
 * are async, so the CSS :root dark defaults paint before getThemePreference
 * resolves. localStorage is synchronous, so applyStoredThemeSync() (called
 * at the top of each page's main.tsx, before React renders) can stamp
 * data-theme before first paint. chrome.storage stays the source of truth —
 * the mirror is rewritten on every read and change, so at worst a stale
 * mirror means one load's first frame is the old theme, then corrects.
 */
const THEME_MIRROR_KEY = 'sq-theme';

function applyTheme(pref: ThemePreference) {
  document.documentElement.dataset.theme = pref;
  try {
    localStorage.setItem(THEME_MIRROR_KEY, pref);
  } catch {
    // localStorage unavailable/full — the mirror is only an anti-flash
    // optimization, never required for correctness.
  }
}

/** Synchronous best-effort theme apply for first paint — see THEME_MIRROR_KEY. */
export function applyStoredThemeSync() {
  try {
    const mirrored = localStorage.getItem(THEME_MIRROR_KEY);
    if (mirrored === 'light' || mirrored === 'dark') {
      document.documentElement.dataset.theme = mirrored;
    }
  } catch {
    // Fall through to the async chrome.storage read in useTheme.
  }
}

/**
 * Reads the stored theme preference, applies it as a `data-theme` attribute
 * on <html> so dashboard.css's `[data-theme="light"]` overrides pick it up,
 * and keeps it live if another tab (Dashboard/Options) changes it. Shared by
 * both pages so there's one read/apply/sync implementation rather than two;
 * only Dashboard actually renders a toggle, but Options still needs to read
 * and apply the current preference so it doesn't look broken when opened.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference | null>(null);

  useEffect(() => {
    getThemePreference().then((pref) => {
      applyTheme(pref);
      setThemeState(pref);
    });

    function onStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }) {
      if (!changes.themePreference) return;
      const next = changes.themePreference.newValue as ThemePreference;
      applyTheme(next);
      setThemeState(next);
    }
    chrome.storage.local.onChanged?.addListener(onStorageChanged);
    return () => chrome.storage.local.onChanged?.removeListener(onStorageChanged);
  }, []);

  async function toggleTheme() {
    const next: ThemePreference = theme === 'light' ? 'dark' : 'light';
    applyTheme(next); // apply immediately, don't wait on the write
    setThemeState(next);
    await setThemePreference(next);
  }

  return { theme, toggleTheme };
}
