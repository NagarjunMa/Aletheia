// Auth Bridge Content Script
// Injected into the Aletheia login tab to relay the Supabase session to the extension.
// Supabase's createBrowserClient stores session data in cookies (via document.cookie)
// but the service worker's chrome.cookies.getAll() may not see them due to cookie
// partitioning, SameSite, or localhost-specific issues. This script reads the session
// directly from the page's cookie jar (which document.cookie CAN access) and sends
// it to the service worker via chrome.runtime.sendMessage.

(function () {
  'use strict';

  console.log('[AUTH-BRIDGE] Loaded on:', window.location.href);

  // Parse Supabase session from document.cookie (client-side visible cookies)
  function getSupabaseSession() {
    const allCookies = document.cookie;
    if (!allCookies) return null;

    const cookiePairs = allCookies.split(';').map(c => c.trim());
    // Exclude PKCE code-verifier cookies (`sb-<ref>-auth-token-code-verifier`)
    // — they share the `-auth-token` substring but carry a plain random
    // string, not a session payload. Including them sends the parser into
    // its final fallback for every prefetch hit.
    const authCookies = cookiePairs.filter(c => {
      if (!c.startsWith('sb-')) return false;
      const name = c.split('=', 1)[0];
      return /^sb-[^=]+-auth-token(?:\.\d+)?$/.test(name);
    });

    if (authCookies.length === 0) return null;

    const rawValue = reassembleAuthCookieValue(authCookies);
    if (!rawValue) return null;
    return parseSupabaseSessionValue(rawValue);
  }

  // Reassemble chunked Supabase auth cookie from name=value pairs.
  // @supabase/ssr ≥0.5 splits the session across `sb-<ref>-auth-token.0`,
  // `.1`, ... when it exceeds the per-cookie size limit (~3180 bytes).
  function reassembleAuthCookieValue(cookiePairs) {
    const parsed = cookiePairs.map(c => {
      const eq = c.indexOf('=');
      if (eq < 0) return null;
      return { name: c.slice(0, eq), value: c.slice(eq + 1) };
    }).filter(Boolean);

    const base = parsed.find(c => /^sb-[^.=]+-auth-token$/.test(c.name));
    if (base) return base.value;

    const chunks = parsed
      .filter(c => /\.\d+$/.test(c.name))
      .sort((a, b) => {
        const ai = parseInt(a.name.split('.').pop(), 10);
        const bi = parseInt(b.name.split('.').pop(), 10);
        return ai - bi;
      });
    return chunks.map(c => c.value).join('');
  }

  // Parse a Supabase session cookie value. Modern @supabase/ssr prefixes
  // the value with the literal string "base64-" before the base64 payload.
  function parseSupabaseSessionValue(rawValue) {
    if (!rawValue) return null;

    let candidate = rawValue;
    try { candidate = decodeURIComponent(rawValue); } catch (e) { /* not URL-encoded */ }

    if (candidate.startsWith('base64-')) {
      try {
        return JSON.parse(atob(candidate.slice(7)));
      } catch (e) {
        // Downgraded from warn — @supabase/ssr writes the real session
        // cookie HttpOnly, so the content script almost never sees it.
        // The bridge is a best-effort signal; the SW server endpoint is
        // the canonical source.
        return null;
      }
    }

    try { return JSON.parse(candidate); } catch (e) { /* try base64 fallback */ }
    try { return JSON.parse(atob(candidate)); } catch (e) {
      // Same: HttpOnly invisibility means this miss is expected.
      return null;
    }
  }

  // Also try reading from localStorage (Supabase non-SSR fallback)
  function getSupabaseSessionFromStorage() {
    try {
      // Supabase stores session under key like sb-<ref>-auth-token
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.includes('-auth-token')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              return JSON.parse(raw);
            } catch (e) { /* not JSON */ }
          }
        }
      }
    } catch (e) {
      // localStorage may not be accessible
    }
    return null;
  }

  function findSession() {
    return getSupabaseSession() || getSupabaseSessionFromStorage();
  }

  function sendSessionToExtension(session) {
    if (!session || !session.access_token) return false;

    console.log('[AUTH-BRIDGE] Found session for:', session.user?.email || 'unknown');

    chrome.runtime.sendMessage({
      action: 'authBridgeSession',
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user: session.user ? {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
        } : null,
      }
    }).catch(err => {
      console.warn('[AUTH-BRIDGE] Could not send session:', err.message);
    });

    return true;
  }

  // Check immediately
  const session = findSession();
  if (session && session.access_token) {
    sendSessionToExtension(session);
  }

  // Also poll periodically (user may be logging in)
  let attempts = 0;
  const MAX_ATTEMPTS = 120; // 120 * 2s = 4 minutes
  const pollInterval = setInterval(() => {
    attempts++;
    if (attempts > MAX_ATTEMPTS) {
      clearInterval(pollInterval);
      return;
    }
    const s = findSession();
    if (s && s.access_token) {
      sendSessionToExtension(s);
      clearInterval(pollInterval);
    }
  }, 2000);

  // Listen for auth state changes via Supabase's storage events
  window.addEventListener('storage', (event) => {
    if (event.key && event.key.startsWith('sb-') && event.key.includes('-auth-token')) {
      console.log('[AUTH-BRIDGE] Storage event detected for:', event.key);
      setTimeout(() => {
        const s = findSession();
        if (s && s.access_token) {
          sendSessionToExtension(s);
          clearInterval(pollInterval);
        }
      }, 500);
    }
  });

  // Also watch for cookie changes via polling (document.cookie doesn't have events)
  let lastCookieString = document.cookie;
  const cookieWatcher = setInterval(() => {
    if (document.cookie !== lastCookieString) {
      lastCookieString = document.cookie;
      const s = findSession();
      if (s && s.access_token) {
        console.log('[AUTH-BRIDGE] Cookie change detected, session found');
        sendSessionToExtension(s);
        clearInterval(cookieWatcher);
        clearInterval(pollInterval);
      }
    }
  }, 1000);

  // Cleanup after 5 minutes
  setTimeout(() => {
    clearInterval(pollInterval);
    clearInterval(cookieWatcher);
  }, 5 * 60 * 1000);

})();
