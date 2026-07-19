import React from 'react';
import { createRoot } from 'react-dom/client';
import { applyStoredThemeSync } from '../lib/useTheme';
import { Dashboard } from './Dashboard';

// Before React renders: stamp the mirrored theme synchronously so a
// light-theme user doesn't get a frame of the CSS dark defaults while the
// async chrome.storage read resolves.
applyStoredThemeSync();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>
);
