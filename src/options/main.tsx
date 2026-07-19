import React from 'react';
import { createRoot } from 'react-dom/client';
import { applyStoredThemeSync } from '../lib/useTheme';
import { Options } from './Options';

// Same anti-flash stamp as dashboard/main.tsx — see applyStoredThemeSync.
applyStoredThemeSync();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
