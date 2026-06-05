// Auth Core — Pure functions extracted from auth.js for testability.
// These functions accept their dependencies (storage, fetch, cookies)
// as parameters, making them mockable in tests.

export const AUTH_STORAGE_KEY = 'aletheia_auth';
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

// ─── Token validation (pure) ───

export function isTokenValid(auth) {
  if (!auth || !auth.access_token || !auth.expires_at) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return auth.expires_at > nowSec;
}

export function needsRefresh(auth, bufferMs = TOKEN_REFRESH_BUFFER_MS) {
  if (!auth || !auth.expires_at) return true;
  const nowMs = Date.now();
  const expiresMs = auth.expires_at * 1000;
  return (expiresMs - nowMs) < bufferMs;
}

// ─── Cookie parsing (pure) ───

export function parseChunkedCookies(cookies) {
  const authCookies = cookies
    .filter(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));

  if (authCookies.length === 0) return null;

  // Single base cookie (`sb-<ref>-auth-token`) takes precedence. Otherwise
  // reassemble numbered chunks (@supabase/ssr ≥0.5 splits sessions across
  // `.0`, `.1`, ... above ~3180 bytes).
  const baseCookie = authCookies.find(c => /^sb-[^.]+-auth-token$/.test(c.name));
  let rawValue;
  if (baseCookie) {
    rawValue = baseCookie.value;
  } else {
    const chunks = authCookies
      .filter(c => /\.\d+$/.test(c.name))
      .sort((a, b) => {
        const ai = parseInt(a.name.split('.').pop(), 10);
        const bi = parseInt(b.name.split('.').pop(), 10);
        return ai - bi;
      });
    rawValue = chunks.map(c => c.value).join('');
  }

  if (!rawValue) return null;

  let candidate = rawValue;
  try { candidate = decodeURIComponent(rawValue); } catch { /* not URL-encoded */ }

  // Modern @supabase/ssr prefixes the value with literal "base64-".
  if (candidate.startsWith('base64-')) {
    try { return JSON.parse(atob(candidate.slice(7))); } catch { return null; }
  }

  try { return JSON.parse(candidate); } catch { /* try base64 fallback */ }
  try { return JSON.parse(atob(candidate)); } catch { return null; }
}

export function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
  };
}

// ─── Storage helpers ───

export async function getStoredAuth(storage) {
  const result = await storage.get(AUTH_STORAGE_KEY);
  return result[AUTH_STORAGE_KEY] || null;
}

export async function storeAuth(storage, authData) {
  await storage.set({
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

export async function clearAuth(storage) {
  await storage.remove(AUTH_STORAGE_KEY);
}

// ─── Session fetching ───

export async function fetchSessionFromServer(apiUrl, fetcher) {
  const response = await fetcher(`${apiUrl}/api/extension/session`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'X-Extension-Source': 'aletheia-extension' },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const err = new Error(errorBody.error || response.statusText);
    err.status = response.status;
    if (response.status === 401) {
      err.retryAfter = parseInt(response.headers.get('Retry-After'), 10) || 0;
      if (errorBody.code === 'refresh_token_already_used') {
        err.code = 'refresh_token_already_used';
      }
    }
    throw err;
  }

  const sessionData = await response.json();
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

export async function fetchSupabaseConfig(apiUrl, fetcher) {
  try {
    const response = await fetcher(`${apiUrl}/api/extension/config`, {
      headers: { 'X-Extension-Source': 'aletheia-extension' },
    });
    if (response.ok) {
      const config = await response.json();
      return { supabase_url: config.supabase_url, supabase_anon_key: config.supabase_anon_key };
    }
  } catch {
    // Non-critical — caller handles absence
  }
  return { supabase_url: undefined, supabase_anon_key: undefined };
}

// ─── Token refresh ───

export async function doRefreshToken(auth, fetcher) {
  if (!auth?.refresh_token || !auth?.supabase_url || !auth?.supabase_anon_key) {
    throw new Error('Missing refresh credentials');
  }

  const response = await fetcher(
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
    const shouldClear = response.status === 400 || response.status === 401;
    const err = new Error(`Token refresh failed: ${response.status}`);
    err.shouldClearAuth = shouldClear;
    throw err;
  }

  const data = await response.json();
  return {
    ...auth,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    user: data.user ? normalizeUser(data.user) : auth.user,
  };
}

// ─── Auth status (pure) ───

export function buildAuthStatus(auth) {
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

// ─── Generate request helpers ───

export function isAuthError(errorMessage) {
  return errorMessage.includes('401') ||
    errorMessage.includes('Unauthorized') ||
    errorMessage.includes('Not authenticated') ||
    errorMessage.includes('Session expired');
}

export function checkUsageLimit(dailyUsage, settings) {
  const today = new Date().toISOString().split('T')[0];
  const todayUsage = dailyUsage[today] || 0;
  const maxDailyUsage = settings.maxDailyUsage || 50;

  if (todayUsage >= maxDailyUsage) {
    throw new Error(`Daily usage limit (${maxDailyUsage}) exceeded. Try again tomorrow.`);
  }
}

export function logUsageData(dailyUsage, categoryUsage, category) {
  const today = new Date().toISOString().split('T')[0];

  dailyUsage[today] = (dailyUsage[today] || 0) + 1;

  if (!categoryUsage[today]) {
    categoryUsage[today] = {};
  }
  categoryUsage[today][category] = (categoryUsage[today][category] || 0) + 1;

  // Clean up old usage data (keep last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

  Object.keys(dailyUsage).forEach(date => {
    if (date < cutoffDate) delete dailyUsage[date];
  });

  Object.keys(categoryUsage).forEach(date => {
    if (date < cutoffDate) delete categoryUsage[date];
  });

  return { dailyUsage, categoryUsage };
}

export function filterAcceptedExamples(accepted, category, limit = 3) {
  return accepted
    .filter(item => item.category === category)
    .map(item => item.body || item.message)
    .slice(-limit);
}
