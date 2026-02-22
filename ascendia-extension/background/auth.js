// Ascendia Extension Auth Module
// Manages Supabase session sharing between web app and extension

const AUTH_STORAGE_KEY = 'ascendia_auth';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

// ─── Storage helpers ───

async function getStoredAuth() {
  const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  return result[AUTH_STORAGE_KEY] || null;
}

async function storeAuth(authData) {
  console.log('[AUTH] Storing auth for:', authData.user?.email || 'unknown');
  await chrome.storage.local.set({
    [AUTH_STORAGE_KEY]: {
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
      expires_at: authData.expires_at,
      user: authData.user,
      supabase_url: authData.supabase_url,
      supabase_anon_key: authData.supabase_anon_key,
      stored_at: Date.now(),
    }
  });
  console.log('[AUTH] Auth stored successfully, expires_at:', authData.expires_at);
}

async function clearAuth() {
  console.log('[AUTH] Clearing stored auth');
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
}

// ─── Token validation ───

function isTokenValid(auth) {
  if (!auth || !auth.access_token || !auth.expires_at) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  const valid = auth.expires_at > nowSec;
  console.log('[AUTH] isTokenValid:', valid, `(expires_at=${auth.expires_at}, now=${nowSec}, remaining=${auth.expires_at - nowSec}s)`);
  return valid;
}

function needsRefresh(auth) {
  if (!auth || !auth.expires_at) return true;
  const nowMs = Date.now();
  const expiresMs = auth.expires_at * 1000;
  const needs = (expiresMs - nowMs) < TOKEN_REFRESH_BUFFER_MS;
  console.log('[AUTH] needsRefresh:', needs, `(${Math.round((expiresMs - nowMs) / 1000)}s until expiry, buffer=${TOKEN_REFRESH_BUFFER_MS / 1000}s)`);
  return needs;
}

// ─── Session fetching via server endpoint ───
// Uses /api/extension/session which validates cookies server-side via Supabase middleware.
// This avoids the problem of chrome.cookies.getAll() not seeing Supabase client-side cookies
// (createBrowserClient may store sessions in localStorage or set cookies that the chrome.cookies
// API cannot read due to domain/SameSite/partitioning issues).

async function fetchSessionFromWebApp(apiUrl) {
  console.log('[AUTH] fetchSessionFromWebApp: calling', apiUrl + '/api/extension/session');

  // Method 1: Server endpoint (reliable — middleware handles cookie validation)
  try {
    const response = await fetch(`${apiUrl}/api/extension/session`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-Extension-Source': 'ascendia-extension',
      },
    });

    console.log('[AUTH] Session endpoint response:', response.status);

    if (response.ok) {
      const sessionData = await response.json();
      console.log('[AUTH] ✓ Session from server endpoint: user=' + (sessionData.user?.email || 'unknown'));

      if (!sessionData.access_token) {
        throw new Error('Server returned session without access_token');
      }

      return {
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
        expires_at: sessionData.expires_at,
        user: sessionData.user,
        supabase_url: sessionData.supabase_url,
        supabase_anon_key: sessionData.supabase_anon_key,
      };
    }

    const errorBody = await response.json().catch(() => ({}));
    console.log('[AUTH] Session endpoint error:', errorBody.error || response.statusText);
  } catch (fetchError) {
    console.warn('[AUTH] Session endpoint fetch failed:', fetchError.message);
  }

  // Method 2: Fallback — read cookies directly via chrome.cookies API
  console.log('[AUTH] Falling back to chrome.cookies.getAll...');
  const cookies = await chrome.cookies.getAll({ url: apiUrl });
  console.log('[AUTH] All cookies for', apiUrl, ':', cookies.map(c => `${c.name}=${c.value.substring(0, 20)}...`).join(', ') || '(none)');

  const authCookies = cookies
    .filter(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log('[AUTH] Auth cookies found:', authCookies.map(c => c.name).join(', ') || '(none)');

  if (authCookies.length === 0) {
    throw new Error('No active session found. Please log in to the web app first.');
  }

  // Reassemble: single cookie or chunked
  let rawValue;
  const baseCookie = authCookies.find(c => /sb-.*-auth-token$/.test(c.name));
  if (baseCookie) {
    rawValue = baseCookie.value;
  } else {
    rawValue = authCookies.map(c => c.value).join('');
  }

  let session;
  try {
    session = JSON.parse(decodeURIComponent(rawValue));
  } catch (e) {
    try {
      session = JSON.parse(atob(rawValue));
    } catch (e2) {
      throw new Error('Could not parse session from cookies. Please log in again.');
    }
  }

  if (!session.access_token) {
    throw new Error('Invalid session data in cookies. Please log in again.');
  }

  // Fetch Supabase config for token refresh
  let supabaseUrl, supabaseAnonKey;
  try {
    const configResp = await fetch(`${apiUrl}/api/extension/config`);
    if (configResp.ok) {
      const config = await configResp.json();
      supabaseUrl = config.supabase_url;
      supabaseAnonKey = config.supabase_anon_key;
    }
  } catch (e) {
    console.warn('[AUTH] Could not fetch Supabase config:', e.message);
  }

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: session.user ? {
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
    } : null,
    supabase_url: supabaseUrl,
    supabase_anon_key: supabaseAnonKey,
  };
}

// ─── Token refresh ───

// In-flight guard: Supabase rotates refresh tokens, so using the same refresh_token
// twice will fail. This ensures only one refresh runs at a time.
let _refreshPromise = null;

async function refreshToken(auth) {
  // If a refresh is already in flight, reuse its result
  if (_refreshPromise) {
    console.log('[AUTH] Refresh already in-flight, reusing...');
    return _refreshPromise;
  }

  _refreshPromise = _doRefreshToken(auth)
    .finally(() => { _refreshPromise = null; });

  return _refreshPromise;
}

async function _doRefreshToken(auth) {
  console.log('[AUTH] Refreshing token via Supabase API...');

  if (!auth || !auth.refresh_token || !auth.supabase_url || !auth.supabase_anon_key) {
    // Try to fetch config if missing
    if (auth && auth.refresh_token && (!auth.supabase_url || !auth.supabase_anon_key)) {
      console.log('[AUTH] Missing Supabase config, fetching...');
      try {
        const { apiUrl } = await chrome.storage.local.get('apiUrl');
        const url = apiUrl || 'http://localhost:3000';
        const configResp = await fetch(`${url}/api/extension/config`);
        if (configResp.ok) {
          const config = await configResp.json();
          auth.supabase_url = config.supabase_url;
          auth.supabase_anon_key = config.supabase_anon_key;
        }
      } catch (e) { /* ignore */ }
    }

    if (!auth?.refresh_token || !auth?.supabase_url || !auth?.supabase_anon_key) {
      console.error('[AUTH] ✗ Missing refresh credentials:', {
        hasRefreshToken: !!auth?.refresh_token,
        hasSupabaseUrl: !!auth?.supabase_url,
        hasAnonKey: !!auth?.supabase_anon_key,
      });
      throw new Error('Missing refresh credentials');
    }
  }

  const response = await fetch(
    `${auth.supabase_url}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': auth.supabase_anon_key,
      },
      body: JSON.stringify({ refresh_token: auth.refresh_token }),
    }
  );

  console.log('[AUTH] Refresh response status:', response.status);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('[AUTH] ✗ Token refresh failed:', response.status, body.substring(0, 200));
    // If refresh token is consumed/expired, clear auth so user gets prompted to re-login
    if (response.status === 400 || response.status === 401) {
      await clearAuth();
    }
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('[AUTH] ✓ Token refreshed, new expires_at:', data.expires_at);

  const updatedAuth = {
    ...auth,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    user: data.user ? {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
    } : auth.user,
  };

  await storeAuth(updatedAuth);
  return updatedAuth;
}

// ─── Main entry point ───

async function getValidAccessToken(apiUrl) {
  console.log('[AUTH] getValidAccessToken for', apiUrl);
  let auth = await getStoredAuth();

  if (auth) {
    console.log('[AUTH] Found stored auth for:', auth.user?.email || 'unknown');
  } else {
    console.log('[AUTH] No stored auth found');
  }

  // If we have a valid, non-expiring-soon token, return it
  if (auth && isTokenValid(auth) && !needsRefresh(auth)) {
    console.log('[AUTH] ✓ Using stored valid token');
    return auth.access_token;
  }

  // Try to refresh if we have a refresh token
  if (auth && auth.refresh_token) {
    try {
      auth = await refreshToken(auth);
      console.log('[AUTH] ✓ Using refreshed token');
      return auth.access_token;
    } catch (refreshError) {
      console.warn('[AUTH] Token refresh failed, will try fetching new session:', refreshError.message);
    }
  }

  // Fall back to fetching a new session from the web app
  try {
    console.log('[AUTH] Trying to fetch session from web app cookies...');
    const sessionData = await fetchSessionFromWebApp(apiUrl);
    await storeAuth(sessionData);
    console.log('[AUTH] ✓ Using session from web app cookies');
    return sessionData.access_token;
  } catch (fetchError) {
    console.error('[AUTH] ✗ fetchSessionFromWebApp failed:', fetchError.message);
    // Clear stale auth
    await clearAuth();
    throw new Error(
      'Not authenticated. Please log in to the Ascendia web app and click "Connect" in the extension.'
    );
  }
}

// ─── Auth status helper ───

async function getAuthStatus() {
  const auth = await getStoredAuth();
  if (!auth || !auth.access_token) {
    console.log('[AUTH] getAuthStatus: not authenticated (no stored auth)');
    return { authenticated: false };
  }
  const valid = isTokenValid(auth);
  console.log('[AUTH] getAuthStatus: authenticated=' + valid + ', user=' + (auth.user?.email || 'unknown'));
  return {
    authenticated: valid,
    user: auth.user || null,
    expires_at: auth.expires_at,
    needs_refresh: needsRefresh(auth),
  };
}

// ─── Wait for login (used by handleAuthenticate) ───
// Keep-alive: MV3 service workers can be terminated. Use alarms to keep alive.
// Recovery from restarts is handled in service-worker.js.

const LOGIN_KEEPALIVE_ALARM = 'ascendia-login-keepalive';

// Pending login resolve/reject — allows authBridgeSession messages to settle the promise
let _loginResolve = null;
let _loginReject = null;

async function waitForLogin(apiUrl) {
  const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  console.log('[AUTH] waitForLogin: opening login tab for', apiUrl);

  // Tab deduplication
  const loginUrl = `${apiUrl}/auth/login?source=extension`;
  const existingTabs = await chrome.tabs.query({ url: `${apiUrl}/auth/login*` });
  let tab;
  if (existingTabs.length > 0) {
    tab = existingTabs[0];
    await chrome.tabs.update(tab.id, { active: true });
    console.log('[AUTH] waitForLogin: reusing existing login tab, id=', tab.id);
  } else {
    tab = await chrome.tabs.create({ url: loginUrl });
    console.log('[AUTH] waitForLogin: new login tab opened, id=', tab.id);
  }

  // Persist login state (survives service worker restart)
  await chrome.storage.local.set({
    _loginPending: {
      apiUrl,
      tabId: tab.id,
      startedAt: Date.now(),
      timeoutAt: Date.now() + LOGIN_TIMEOUT_MS,
    }
  });

  // Set keepalive alarm to prevent service worker termination during login
  chrome.alarms.create(LOGIN_KEEPALIVE_ALARM, { periodInMinutes: 25 / 60 });

  // Start polling for session
  return pollUntilSession(apiUrl, tab.id, Date.now() + LOGIN_TIMEOUT_MS);
}

// Inject auth-bridge content script into the login tab
async function injectAuthBridge(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/auth-bridge.js'],
    });
    console.log('[AUTH] auth-bridge.js injected into tab', tabId);
  } catch (e) {
    console.warn('[AUTH] Could not inject auth-bridge.js:', e.message);
  }
}

// Handle session data sent from auth-bridge content script
function handleAuthBridgeSession(sessionData) {
  if (!sessionData || !sessionData.access_token) return;

  console.log('[AUTH] authBridgeSession received for:', sessionData.user?.email || 'unknown');

  // Fetch Supabase config and store
  chrome.storage.local.get('apiUrl').then(async ({ apiUrl }) => {
    const url = apiUrl || 'http://localhost:3000';
    let supabaseUrl, supabaseAnonKey;
    try {
      const configResp = await fetch(`${url}/api/extension/config`);
      if (configResp.ok) {
        const config = await configResp.json();
        supabaseUrl = config.supabase_url;
        supabaseAnonKey = config.supabase_anon_key;
      }
    } catch (e) { /* ignore */ }

    const authData = {
      ...sessionData,
      supabase_url: supabaseUrl,
      supabase_anon_key: supabaseAnonKey,
    };

    await storeAuth(authData);

    // Resolve the pending login promise
    if (_loginResolve) {
      _loginResolve(authData);
      _loginResolve = null;
      _loginReject = null;
    }
  });
}

// Uses setTimeout loop + content script bridge + cookie/tab listeners
function pollUntilSession(apiUrl, tabId, timeoutAt) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer = null;
    let cookieDebounceTimer = null;
    let timeoutTimer = null;
    let bridgeInjected = false;

    // Store resolve/reject so authBridgeSession messages can settle this promise
    _loginResolve = (data) => settle(() => resolve(data));
    _loginReject = (err) => settle(() => reject(err));

    function cleanup() {
      console.log('[AUTH] pollUntilSession: cleanup');
      chrome.cookies.onChanged.removeListener(cookieListener);
      chrome.tabs.onUpdated.removeListener(tabListener);
      chrome.alarms.clear(LOGIN_KEEPALIVE_ALARM);
      chrome.storage.local.remove('_loginPending');
      clearTimeout(pollTimer);
      clearTimeout(cookieDebounceTimer);
      clearTimeout(timeoutTimer);
      _loginResolve = null;
      _loginReject = null;
      // Auto-close the login tab
      try { chrome.tabs.remove(tabId); } catch (e) { /* already closed */ }
    }

    function settle(fn) {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    }

    async function tryFetchSession() {
      try {
        const sessionData = await fetchSessionFromWebApp(apiUrl);
        console.log('[AUTH] pollUntilSession: session found for', sessionData.user?.email);
        await storeAuth(sessionData);
        settle(() => resolve(sessionData));
      } catch (e) {
        console.log('[AUTH] pollUntilSession: no session yet:', e.message);
      }
    }

    // Cookie change listener (debounced for chunked cookies)
    function cookieListener(changeInfo) {
      if (changeInfo.removed) return;
      const { cookie } = changeInfo;
      if (cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token')) {
        console.log('[AUTH] cookie detected:', cookie.name);
        clearTimeout(cookieDebounceTimer);
        cookieDebounceTimer = setTimeout(() => tryFetchSession(), 500);
      }
    }
    chrome.cookies.onChanged.addListener(cookieListener);

    // Tab load listener — inject auth-bridge when login tab loads
    function tabListener(tid, changeInfo) {
      if (tid === tabId && changeInfo.status === 'complete') {
        console.log('[AUTH] login tab finished loading, injecting auth-bridge...');
        if (!bridgeInjected) {
          bridgeInjected = true;
          injectAuthBridge(tabId);
        } else {
          // Tab reloaded (e.g., after form submit) — re-inject
          injectAuthBridge(tabId);
        }
        // Also try server endpoint as fallback
        setTimeout(() => tryFetchSession(), 1000);
      }
    }
    chrome.tabs.onUpdated.addListener(tabListener);

    // setTimeout-based polling (not subject to 30s alarm minimum)
    function schedulePoll() {
      pollTimer = setTimeout(async () => {
        if (settled) return;
        await tryFetchSession();
        if (!settled) schedulePoll();
      }, 3000);
    }
    schedulePoll();

    // Timeout
    const remaining = timeoutAt - Date.now();
    timeoutTimer = setTimeout(() => {
      console.log('[AUTH] pollUntilSession: timed out');
      settle(() => reject(new Error('Login timed out. Please try again.')));
    }, Math.max(remaining, 0));
  });
}

// ─── Proactive refresh (called by alarm) ───

async function proactiveRefresh(apiUrl) {
  const auth = await getStoredAuth();
  if (!auth) return;

  if (needsRefresh(auth) && auth.refresh_token) {
    try {
      await refreshToken(auth);
      console.log('[AUTH] Proactive token refresh successful');
    } catch (error) {
      console.warn('[AUTH] Proactive token refresh failed:', error.message);
      // Try fetching from web app as fallback
      try {
        const sessionData = await fetchSessionFromWebApp(apiUrl);
        await storeAuth(sessionData);
        console.log('[AUTH] Proactive session fetch successful');
      } catch (fetchError) {
        console.warn('[AUTH] Proactive session fetch failed:', fetchError.message);
      }
    }
  }
}
