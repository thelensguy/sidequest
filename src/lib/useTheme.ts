import { useEffect, useState } from 'react';
import { getThemePreference, setThemePreference } from './storage';
import type { ThemePreference } from './types';

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
      document.documentElement.dataset.theme = pref;
      setThemeState(pref);
    });

    function onStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }) {
      if (!changes.themePreference) return;
      const next = changes.themePreference.newValue as ThemePreference;
      document.documentElement.dataset.theme = next;
      setThemeState(next);
    }
    chrome.storage.local.onChanged?.addListener(onStorageChanged);
    return () => chrome.storage.local.onChanged?.removeListener(onStorageChanged);
  }, []);

  async function toggleTheme() {
    const next: ThemePreference = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next; // apply immediately, don't wait on the write
    setThemeState(next);
    await setThemePreference(next);
  }

  return { theme, toggleTheme };
}
