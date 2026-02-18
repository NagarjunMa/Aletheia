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
}

async function clearAuth() {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
}

// ─── Token validation ───

function isTokenValid(auth) {
  if (!auth || !auth.access_token || !auth.expires_at) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return auth.expires_at > nowSec;
}

function needsRefresh(auth) {
  if (!auth || !auth.expires_at) return true;
  const nowMs = Date.now();
  const expiresMs = auth.expires_at * 1000;
  return (expiresMs - nowMs) < TOKEN_REFRESH_BUFFER_MS;
}

// ─── Session fetching ───

async function fetchSessionFromWebApp(apiUrl) {
  const url = `${apiUrl}/api/extension/session`;
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { 'X-Extension-Source': 'ascendia-extension' },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    // On 401, open the web app login page so the user can re-authenticate
    if (response.status === 401) {
      chrome.tabs.create({ url: `${apiUrl}/auth/login` });
      throw new Error('Session expired. A login page has been opened — please log in and try connecting again.');
    }

    throw new Error(data.error || `Session fetch failed: ${response.status}`);
  }

  return response.json();
}

// ─── Token refresh ───

async function refreshToken(auth) {
  if (!auth || !auth.refresh_token || !auth.supabase_url || !auth.supabase_anon_key) {
    throw new Error('Missing refresh credentials');
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

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();

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
  let auth = await getStoredAuth();

  // If we have a valid, non-expiring-soon token, return it
  if (auth && isTokenValid(auth) && !needsRefresh(auth)) {
    return auth.access_token;
  }

  // Try to refresh if we have a refresh token
  if (auth && auth.refresh_token) {
    try {
      auth = await refreshToken(auth);
      return auth.access_token;
    } catch (refreshError) {
      console.warn('Token refresh failed, will try fetching new session:', refreshError.message);
    }
  }

  // Fall back to fetching a new session from the web app
  try {
    const sessionData = await fetchSessionFromWebApp(apiUrl);
    await storeAuth(sessionData);
    return sessionData.access_token;
  } catch (fetchError) {
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
    return { authenticated: false };
  }
  return {
    authenticated: isTokenValid(auth),
    user: auth.user || null,
    expires_at: auth.expires_at,
    needs_refresh: needsRefresh(auth),
  };
}

// ─── Proactive refresh (called by alarm) ───

async function proactiveRefresh(apiUrl) {
  const auth = await getStoredAuth();
  if (!auth) return;

  if (needsRefresh(auth) && auth.refresh_token) {
    try {
      await refreshToken(auth);
      console.log('Proactive token refresh successful');
    } catch (error) {
      console.warn('Proactive token refresh failed:', error.message);
      // Try fetching from web app as fallback
      try {
        const sessionData = await fetchSessionFromWebApp(apiUrl);
        await storeAuth(sessionData);
        console.log('Proactive session fetch successful');
      } catch (fetchError) {
        console.warn('Proactive session fetch failed:', fetchError.message);
      }
    }
  }
}
