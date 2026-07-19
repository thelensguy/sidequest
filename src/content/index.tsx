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
import { getBubbleSettings, isBubbleHiddenUntilRestart } from '../lib/storage';
import { getCurrentCaptureSite } from './currentSite';

const HOST_ID = 'sidequest-content-host';

async function mount() {
  // Guard against double-mounting. MV3 content scripts normally inject
  // once per real navigation, but this keeps things safe against dev/HMR
  // reloads or any future manifest change that could re-run this entry
  // point against a page that already has one.
  if (document.getElementById(HOST_ID)) return;

  // isBubbleHiddenUntilRestart() touches chrome.storage.session, which
  // needs the background service worker to have widened its access level
  // (see src/background/index.ts) before a content script can use it at
  // all. If that hasn't happened yet for any reason — extension just
  // updated and the service worker hasn't run, an older Chrome, etc. —
  // this must not take the whole bubble down with it; fall back to "not
  // session-hidden" and keep going instead of leaving the page with no
  // bubble at all.
  const [settings, hiddenUntilRestart] = await Promise.all([
    getBubbleSettings(),
    isBubbleHiddenUntilRestart().catch(() => false),
  ]);
  const site = getCurrentCaptureSite();
  const hiddenBySettings =
    settings.hiddenGlobally || (site !== null && settings.hiddenDomains.includes(site));

  // Mount even when hidden (ContentApp renders null) rather than bailing
  // out: ContentApp watches bubbleSettings via storage.onChanged, so
  // re-enabling the bubble from the Options page takes effect on
  // already-open tabs without a reload. Only the session-scoped "hide
  // until restart" is final for this page's lifetime — Options has no
  // control that clears it; it self-clears when the browser restarts.

  // Re-check after the awaits above — unlike the synchronous version this
  // replaced, another invocation now has a window to mount first.
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  // Set directly on the element's own style (not via a stylesheet rule),
  // which take precedence over any non-!important rule the host page
  // ships — including a light-DOM element like this one, that isn't
  // shielded by the shadow boundary the way its children are.
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.top = `${settings.verticalPercent}%`;
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
      <ContentApp
        host={host}
        initialSettingsHidden={hiddenBySettings}
        initialSessionHidden={hiddenUntilRestart}
      />
    </React.StrictMode>
  );
}

/** True when this node is, or contains, a top-layer candidate (native dialog / Popover API element). */
function involvesTopLayerElement(node: Node, host: HTMLElement): boolean {
  if (!(node instanceof Element) || node === host) return false;
  if (node.tagName === 'DIALOG' || node.hasAttribute('popover')) return true;
  return node.querySelector?.('dialog, [popover]') !== null;
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
 * popover (hide, then show again) when a top-layer candidate enters the
 * DOM or gets opened. An earlier version re-bumped on EVERY childList
 * mutation, which on an infinite-scroll job feed meant a hide/show cycle
 * per scroll burst for the lifetime of the page — this one only reacts to
 * mutations actually involving a dialog/popover element, additionally
 * watches the `open`/`popover` attributes (showModal() on a pre-existing
 * <dialog> adds no nodes at all), and pauses while the tab is hidden.
 */
function promoteAboveNativeModals(host: HTMLElement) {
  if (typeof host.showPopover !== 'function') return; // unsupported browser: no-op, z-index-only behavior unchanged

  host.setAttribute('popover', 'manual');
  host.showPopover();

  let rebumpTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleRebump() {
    // Debounce: a modal mounting touches many nodes in one burst — re-bump
    // once per burst, not once per mutated node.
    if (rebumpTimer !== undefined) clearTimeout(rebumpTimer);
    rebumpTimer = setTimeout(() => {
      if (host.matches(':popover-open')) host.hidePopover();
      host.showPopover();
    }, 150);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        if (involvesTopLayerElement(mutation.target, host)) {
          scheduleRebump();
          return;
        }
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (involvesTopLayerElement(node, host)) {
          scheduleRebump();
          return;
        }
      }
    }
  });

  function observe() {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'popover'],
    });
  }
  observe();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      observer.disconnect();
      if (rebumpTimer !== undefined) clearTimeout(rebumpTimer);
    } else {
      // One catch-up bump for anything that opened while we weren't
      // watching, then resume.
      scheduleRebump();
      observe();
    }
  });
}

if (document.body) {
  void mount();
} else {
  document.addEventListener('DOMContentLoaded', () => void mount(), { once: true });
}
