import React from 'react';
import { createRoot } from 'react-dom/client';
import { ContentApp } from './ContentApp';
// `?inline` tells Vite to return the compiled CSS as a plain string instead
// of emitting/auto-injecting it as a page-level stylesheet. That matters
// here specifically: CRXJS's default handling for a CSS import from a
// content script entry is to register it in the manifest's
// content_scripts.css array, which Chrome injects directly into the host
// page's <head> — exactly the global-leakage this shadow-DOM approach is
// meant to avoid. Inlining it lets us hand the string to our own <style>
// element inside the shadow root instead.
import contentStyles from './content.css?inline';

const HOST_ID = 'sidequest-content-host';

function mount() {
  // Guard against double-mounting. MV3 content scripts normally inject
  // once per real navigation, but this keeps things safe against dev/HMR
  // reloads or any future manifest change that could re-run this entry
  // point against a page that already has one.
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  // Set directly on the element's own style (not via a stylesheet rule),
  // which take precedence over any non-!important rule the host page
  // ships — including a light-DOM element like this one, that isn't
  // shielded by the shadow boundary the way its children are.
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.bottom = '20px';
  host.style.right = '20px';
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = contentStyles;
  shadowRoot.appendChild(style);

  const mountPoint = document.createElement('div');
  shadowRoot.appendChild(mountPoint);

  createRoot(mountPoint).render(
    <React.StrictMode>
      <ContentApp />
    </React.StrictMode>
  );
}

if (document.body) {
  mount();
} else {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
}
