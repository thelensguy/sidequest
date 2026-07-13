/**
 * chrome.storage.session defaults to TRUSTED_CONTEXTS-only access (the
 * background service worker, popup, options page) — content scripts
 * can't read/write it at all unless a trusted context calls
 * setAccessLevel() to widen that. This extension had no background
 * service worker until now, so the content script's session-storage
 * calls (isBubbleHiddenUntilRestart/hideBubbleUntilRestart in
 * src/lib/storage.ts) were throwing on every page load, aborting mount()
 * before the capture bubble ever got created.
 *
 * This runs once whenever the service worker starts up (extension
 * install/update, or Chrome waking it after it's been dormant) — cheap
 * and idempotent, so no need to gate it behind onInstalled specifically.
 */
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
