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

    // Find sb-<ref>-auth-token cookies
    const cookiePairs = allCookies.split(';').map(c => c.trim());
    const authCookies = cookiePairs
      .filter(c => c.startsWith('sb-') && c.includes('-auth-token'))
      .sort();

    if (authCookies.length === 0) return null;

    // Find base cookie or concatenate chunks
    let rawValue;
    const basePair = authCookies.find(c => /^sb-.*-auth-token=/.test(c));
    if (basePair) {
      rawValue = basePair.split('=').slice(1).join('=');
    } else {
      rawValue = authCookies.map(c => c.split('=').slice(1).join('=')).join('');
    }

    if (!rawValue) return null;

    try {
      return JSON.parse(decodeURIComponent(rawValue));
    } catch (e) {
      try {
        return JSON.parse(atob(rawValue));
      } catch (e2) {
        console.warn('[AUTH-BRIDGE] Could not parse session cookie');
        return null;
      }
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
