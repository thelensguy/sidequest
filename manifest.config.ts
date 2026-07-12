import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'SideQuest',
  description: 'A gamified job application tracker.',
  version: pkg.version,
  action: {
    default_popup: 'src/popup/index.html',
  },
  options_page: 'src/options/index.html',
  permissions: ['storage', 'activeTab', 'scripting'],
  content_scripts: [
    {
      matches: [
        '*://*.linkedin.com/*',
        '*://*.indeed.com/*',
        '*://*.ziprecruiter.com/*',
      ],
      js: ['src/content/index.tsx'],
      run_at: 'document_idle',
    },
  ],
});
