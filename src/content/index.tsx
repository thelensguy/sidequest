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
  host.style.top = '50%';
  host.style.right = '0';
  host.style.transform = 'translateY(-50%)';
  document.body.appendChild(host);

  promoteAboveNativeModals(host);

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

/**
 * A high z-index only wins within the normal DOM stacking hierarchy — it
 * can't beat the browser's "top layer" (native <dialog>, fullscreen
 * elements, and Popover-API elements), which always paints above regular
 * content no matter its z-index. Job sites frequently build their "view
 * posting" panel as a full-viewport <dialog>, which was silently covering
 * the bubble even at z-index 2147483647. Joining the top layer ourselves
 * (via the same Popover API) is the only way to actually stay above one.
 *
 * Elements stack within the top layer in the order they were shown, most
 * recent on top — so a <dialog> opened *after* we first show our popover
 * would still end up above us. The MutationObserver below re-bumps our
 * popover (hide, then show again) whenever the page's DOM changes, which
 * covers a modal mounting after us without needing to know that specific
 * site's markup.
 */
function promoteAboveNativeModals(host: HTMLElement) {
  if (typeof host.showPopover !== 'function') return; // unsupported browser: no-op, z-index-only behavior unchanged

  host.setAttribute('popover', 'manual');
  host.showPopover();

  let rebumpTimer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    // Debounce: a modal mounting touches many nodes in one burst: only
    // re-bump once per burst, not once per mutated node.
    if (rebumpTimer !== undefined) clearTimeout(rebumpTimer);
    rebumpTimer = setTimeout(() => {
      if (host.matches(':popover-open')) host.hidePopover();
      host.showPopover();
    }, 150);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.body) {
  mount();
} else {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
}
