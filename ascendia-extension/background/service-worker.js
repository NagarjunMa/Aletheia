// Aletheia Extension Background Service Worker
// Handles API communication with the Aletheia backend

// Import auth module
importScripts('auth.js');

// In-flight guard: prevents duplicate authenticate calls from opening multiple tabs
let authenticatePromise = null;

// Recover from service worker restart during login
(async function recoverPendingLogin() {
  const { _loginPending } = await chrome.storage.local.get('_loginPending');
  if (!_loginPending) return;

  const { apiUrl, tabId, timeoutAt } = _loginPending;
  if (Date.now() > timeoutAt) {
    console.log('[SW] Pending login expired, cleaning up');
    await chrome.storage.local.remove('_loginPending');
    return;
  }

  console.log('[SW] Recovering pending login for', apiUrl);
  // Try to fetch the session immediately (user may have already logged in)
  try {
    const sessionData = await fetchSessionFromWebApp(apiUrl);
    await storeAuth(sessionData);
    await chrome.storage.local.remove('_loginPending');
    try { chrome.tabs.remove(tabId); } catch (e) {}
    chrome.alarms.clear('aletheia-login-keepalive');
    console.log('[SW] Recovered session for', sessionData.user?.email);
  } catch (e) {
    console.log('[SW] Recovery: no session yet, will keep checking via alarms');
    // Keep the keepalive alarm running; next alarm cycle will retry
    chrome.alarms.create('aletheia-login-keepalive', { periodInMinutes: 25 / 60 });
  }
})();

// Cold-start alarm guard: re-create token refresh alarm if service worker
// wakes on a non-startup/non-install event and the alarm is missing.
chrome.alarms.get('aletheia-token-refresh', (alarm) => {
  if (!alarm) {
    console.log('[SW] Token refresh alarm missing after cold start, re-creating');
    chrome.alarms.create('aletheia-token-refresh', { periodInMinutes: 20 });
  }
});

// Extension configuration
const CONFIG = {
  DEFAULT_API_URL: 'https://www.aletheia.live', // Production default
  API_ENDPOINTS: {
    generate: '/api/extension/generate',
    health: '/api/extension/generate'
  },
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  TOKEN_REFRESH_ALARM: 'aletheia-token-refresh',
  TOKEN_REFRESH_INTERVAL_MIN: 20 // Refresh every 20 minutes (well before 1hr JWT expiry)
};

// Installation and startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Aletheia extension installed:', details);

  if (details.reason === 'install') {
    await initializeDefaultSettings();
  }

  // Inject content scripts into already-open LinkedIn tabs
  // (Chrome does NOT auto-inject on install/update)
  try {
    const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/in/*' });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/linkedin-reader.js']
        }).catch(err => console.warn('Could not inject into tab', tab.id, err));
      }
    }
  } catch (err) {
    console.warn('Content script injection failed:', err);
  }

  // Set up proactive token refresh alarm
  chrome.alarms.create(CONFIG.TOKEN_REFRESH_ALARM, {
    periodInMinutes: CONFIG.TOKEN_REFRESH_INTERVAL_MIN
  });

  // Context menu setup (guard against duplicate IDs on update/reinstall)
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'generateMessage',
      title: 'Generate message with Aletheia',
      contexts: ['selection'],
      documentUrlPatterns: ['https://www.linkedin.com/*']
    });
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Aletheia extension started');

  // Ensure token refresh alarm exists
  chrome.alarms.create(CONFIG.TOKEN_REFRESH_ALARM, {
    periodInMinutes: CONFIG.TOKEN_REFRESH_INTERVAL_MIN
  });
});

// Alarm handler for proactive token refresh + login recovery
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === CONFIG.TOKEN_REFRESH_ALARM) {
    console.log('[SW] Token refresh alarm fired');
    const url = await getEffectiveApiUrl();
    await proactiveRefresh(url);
  }

  if (alarm.name === 'aletheia-login-keepalive') {
    console.log('[SW] Login keepalive — checking for session...');
    const { _loginPending } = await chrome.storage.local.get('_loginPending');
    if (!_loginPending) return;

    if (Date.now() > _loginPending.timeoutAt) {
      console.log('[SW] Login timed out during recovery');
      await chrome.storage.local.remove('_loginPending');
      chrome.alarms.clear('aletheia-login-keepalive');
      return;
    }

    try {
      const sessionData = await fetchSessionFromWebApp(_loginPending.apiUrl);
      await storeAuth(sessionData);
      await chrome.storage.local.remove('_loginPending');
      try { chrome.tabs.remove(_loginPending.tabId); } catch (e) {}
      chrome.alarms.clear('aletheia-login-keepalive');
      console.log('[SW] Session recovered via keepalive alarm');
    } catch (e) {
      console.log('[SW] Keepalive check: no session yet');
    }
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[SW] Message received:', message.action, 'from:', sender.url?.substring(0, 60) || sender.id);

  if (message.action === 'generate') {
    handleGenerateRequest(message.payload)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({
        success: false,
        error: error.message || 'Generation failed'
      }));
    return true;
  }

  if (message.action === 'healthCheck') {
    handleHealthCheck()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({
        success: false,
        error: error.message || 'Health check failed'
      }));
    return true;
  }

  if (message.action === 'authenticate') {
    console.log('[SW] authenticate: authenticatePromise is', authenticatePromise ? 'IN-FLIGHT (reusing)' : 'null (starting new)');
    if (!authenticatePromise) {
      authenticatePromise = handleAuthenticate()
        .then(result => {
          console.log('[SW] authenticate: ✓ completed successfully');
          authenticatePromise = null;
          return result;
        })
        .catch(error => {
          console.error('[SW] authenticate: ✗ failed:', error.message);
          authenticatePromise = null;
          throw error;
        });
    }
    authenticatePromise
      .then(result => sendResponse(result))
      .catch(error => sendResponse({
        success: false,
        error: error.message || 'Authentication failed'
      }));
    return true;
  }

  if (message.action === 'logout') {
    handleLogout()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({
        success: false,
        error: error.message || 'Logout failed'
      }));
    return true;
  }

  if (message.action === 'getAuthStatus') {
    getAuthStatus()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({
        authenticated: false,
        error: error.message
      }));
    return true;
  }

  // Silent auth check: try to detect an existing web session without opening any tabs.
  // Used by popup on initialization to auto-detect if user is already logged in.
  if (message.action === 'silentAuthCheck') {
    (async () => {
      try {
        const url = await getEffectiveApiUrl();
        await getValidAccessToken(url);
        const status = await getAuthStatus();
        console.log('[SW] silentAuthCheck: ✓ found session for', status.user?.email);
        sendResponse(status);
      } catch (error) {
        console.log('[SW] silentAuthCheck: no session available:', error.message);
        sendResponse({ authenticated: false });
      }
    })();
    return true;
  }

  // Auth bridge: content script on login page found the Supabase session
  if (message.action === 'authBridgeSession') {
    console.log('[SW] authBridgeSession received from:', sender.url?.substring(0, 60));
    handleAuthBridgeSession(message.session);
    sendResponse({ success: true });
    return true;
  }

  // Send feedback to backend (fire-and-forget)
  if (message.action === 'sendFeedback') {
    sendResponse({ success: true }); // Respond immediately, don't block UI
    (async () => {
      try {
        const url = await getEffectiveApiUrl();
        const accessToken = await getValidAccessToken(url);
        await fetch(`${url}/api/extension/feedback`, {
          method: 'POST',
          headers: getAletheiaRequestHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }),
          body: JSON.stringify(message.payload)
        });
        console.log('[SW] Feedback sent successfully');
      } catch (err) {
        console.warn('[SW] Feedback send failed (non-blocking):', err.message);
      }
    })();
    return true;
  }

  return false;
});

// Helper: resolve the effective API URL from sync > local > default.
// Only allow hosts present in manifest host_permissions to prevent
// stale storage values (e.g. localhost from dev installs, *.vercel.app
// from earlier prod fallback) from routing requests to disallowed
// origins after manifest narrowing.
const ALLOWED_API_HOSTS = ['aletheia.live', 'www.aletheia.live'];
function normalizeApiUrl(value) {
  let normalized = String(value || '').trim();
  while (normalized.endsWith('/') && !normalized.endsWith('://')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
function isAllowedApiUrl(value) {
  const normalized = normalizeApiUrl(value);
  if (!normalized) return false;
  try {
    return ALLOWED_API_HOSTS.includes(new URL(normalized).hostname);
  } catch {
    return false;
  }
}
async function getEffectiveApiUrl() {
  const { apiBaseUrl } = await chrome.storage.sync.get('apiBaseUrl');
  if (isAllowedApiUrl(apiBaseUrl)) return normalizeApiUrl(apiBaseUrl);
  if (apiBaseUrl) {
    await chrome.storage.sync.remove('apiBaseUrl');
    console.log('[SW] Wiped stale apiBaseUrl from sync storage');
  }
  const { apiUrl } = await chrome.storage.local.get('apiUrl');
  if (isAllowedApiUrl(apiUrl)) return normalizeApiUrl(apiUrl);
  if (apiUrl) {
    await chrome.storage.local.remove('apiUrl');
    console.log('[SW] Wiped stale apiUrl from local storage');
  }
  return CONFIG.DEFAULT_API_URL;
}

async function initializeDefaultSettings() {
  // Check if user has a saved API URL in sync storage (shared across devices)
  const { apiBaseUrl } = await chrome.storage.sync.get('apiBaseUrl');
  const apiUrl = normalizeApiUrl(apiBaseUrl || CONFIG.DEFAULT_API_URL);

  const defaults = {
    apiUrl,
    accepted: [],
    dailyUsage: {},
    settings: {
      autoFillEnabled: true,
      showNotifications: true,
      maxDailyUsage: 50
    }
  };

  await chrome.storage.local.set(defaults);
  console.log('Default settings initialized with API URL:', apiUrl);
}

async function handleAuthenticate() {
  const url = await getEffectiveApiUrl();
  console.log('[SW] handleAuthenticate: using API URL:', url);

  // First try: maybe the user is already logged in (cookies exist)
  try {
    console.log('[SW] handleAuthenticate: trying existing session...');
    const token = await getValidAccessToken(url);
    const status = await getAuthStatus();
    console.log('[SW] handleAuthenticate: ✓ already authenticated as', status.user?.email);
    return {
      success: true,
      user: status.user,
      message: 'Connected to Aletheia'
    };
  } catch (error) {
    console.log('[SW] handleAuthenticate: no existing session:', error.message);
    // No existing session — open login tab and wait for cookies
  }

  // Second try: open login page and wait for the user to authenticate
  try {
    console.log('[SW] handleAuthenticate: opening login tab and waiting...');
    const sessionData = await waitForLogin(url);
    console.log('[SW] handleAuthenticate: ✓ login completed for', sessionData.user?.email);
    return {
      success: true,
      user: sessionData.user,
      message: 'Connected to Aletheia'
    };
  } catch (waitError) {
    console.error('[SW] handleAuthenticate: ✗ waitForLogin failed:', waitError.message);
    throw new Error(waitError.message || 'Login failed. Please try again.');
  }
}

async function handleLogout() {
  await clearAuth();
  return { success: true, message: 'Disconnected from Aletheia' };
}

async function handleGenerateRequest(payload) {
  const url = await getEffectiveApiUrl();
  const MAX_AUTH_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_AUTH_ATTEMPTS; attempt++) {
    try {
      // Get valid access token (handles refresh automatically)
      const accessToken = await getValidAccessToken(url);

      console.log(`[SW] handleGenerateRequest attempt ${attempt}: using API URL:`, url);

      // Check daily usage limit (client-side advisory only) — only on first attempt
      if (attempt === 0) {
        await checkUsageLimit();
      }

      // Get accepted examples for style learning
      const { accepted = [] } = await chrome.storage.local.get('accepted');
      const relevantExamples = accepted
        .filter(item => item.category === payload.category)
        .map(item => item.body || item.message)
        .slice(-3);

      const requestData = {
        ...payload,
        acceptedExamples: relevantExamples
      };

      // Make API request with Bearer token
      const response = await makeAPIRequest('/api/extension/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(requestData)
      }, url);

      if (!response.success) {
        throw new Error(response.error || 'API request failed');
      }

      await logUsage(payload.category);
      return response;

    } catch (error) {
      console.error(`[SW] handleGenerateRequest attempt ${attempt} error:`, error.message);

      const isAuthError = error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Not authenticated') ||
        error.message.includes('Session expired');

      if (!isAuthError) {
        // Non-auth errors: don't retry, surface immediately
        if (error.status === 402 || error.code === 'INSUFFICIENT_CREDITS' || error.message.includes('402')) {
          throw new Error(error.message || 'You are out of credits. Buy more credits in the Aletheia dashboard.');
        }
        if (error.message.includes('429') || error.message.includes('Rate limit') || error.message.includes('Daily limit')) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
          throw new Error('Network error. Please check your internet connection.');
        }
        throw error;
      }

      // Auth error retry logic
      if (attempt === 0) {
        // Attempt 1: Silently re-fetch session from web app cookies
        console.log('[SW] handleGenerateRequest: 401 on attempt 0, silently re-fetching session...');
        try {
          await clearAuthAndFetchFresh(url);
          console.log('[SW] handleGenerateRequest: ✓ fresh session obtained, retrying...');
          continue; // retry with new token
        } catch (refreshErr) {
          console.warn('[SW] handleGenerateRequest: silent re-fetch failed:', refreshErr.message);
          // Fall through to attempt 1
        }
      }

      if (attempt === 1) {
        // Attempt 2: Open login tab, wait for user to authenticate
        console.log('[SW] handleGenerateRequest: 401 on attempt 1, clearing auth and triggering interactive login...');
        await clearAuth();
        try {
          await handleAuthenticate();
          console.log('[SW] handleGenerateRequest: ✓ user re-authenticated, retrying...');
          continue; // retry with new token
        } catch (authErr) {
          console.error('[SW] handleGenerateRequest: interactive login failed:', authErr.message);
        }
      }

      // All attempts exhausted
      throw new Error('AUTH_FAILED: Not authenticated. Please log in to the Aletheia web app and connect the extension.');
    }
  }

  // Should never reach here, but just in case
  throw new Error('AUTH_FAILED: Authentication failed after multiple attempts.');
}

async function makeAPIRequest(endpoint, options = {}, baseUrl = null) {
  const url = (baseUrl || CONFIG.DEFAULT_API_URL) + endpoint;
  let lastError;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`API request attempt ${attempt}/${CONFIG.MAX_RETRIES}: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

      const response = await fetch(url, {
        ...options,
        headers: getAletheiaRequestHeaders(options.headers || {}),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch (_jsonError) {
          errorBody = null;
        }

        const apiMessage =
          errorBody?.message ||
          errorBody?.error ||
          response.statusText ||
          'API request failed';
        const updateHint =
          response.status === 426 && errorBody?.chromeWebStoreUrl
            ? ` Update from ${errorBody.chromeWebStoreUrl}`
            : '';
        const apiError = new Error(
          `HTTP ${response.status}: ${apiMessage}${updateHint}`
        );
        apiError.status = response.status;
        apiError.code = errorBody?.code;
        apiError.updateUrl = errorBody?.chromeWebStoreUrl;
        throw apiError;
      }

      const data = await response.json();
      console.log('API request successful:', { endpoint, status: response.status });

      return data;

    } catch (error) {
      lastError = error;
      console.warn(`API request attempt ${attempt} failed:`, error.message);

      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please try again.');
      }

      if (
        error.status === 402 ||
        error.code === 'INSUFFICIENT_CREDITS' ||
        error.message.includes('402')
      ) {
        throw error;
      }

      if (
        error.status === 426 ||
        error.code === 'EXTENSION_UPDATE_REQUIRED' ||
        error.code === 'API_VERSION_UNSUPPORTED'
      ) {
        throw error;
      }

      if (error.message.includes('401') || error.message.includes('403')) {
        throw error;
      }

      if (attempt < CONFIG.MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

async function handleHealthCheck() {
  try {
    const url = await getEffectiveApiUrl();

    // Check if we have valid auth
    const status = await getAuthStatus();
    if (!status.authenticated) {
      return {
        success: false,
        error: 'Not connected. Please log in to the web app and connect the extension.'
      };
    }

    const accessToken = await getValidAccessToken(url);

    const response = await makeAPIRequest('/api/extension/generate', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }, url);

    return {
      success: true,
      data: response
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function checkUsageLimit() {
  const { dailyUsage = {}, settings = {} } = await chrome.storage.local.get(['dailyUsage', 'settings']);

  const today = new Date().toISOString().split('T')[0];
  const todayUsage = dailyUsage[today] || 0;
  const maxDailyUsage = settings.maxDailyUsage || 50;

  if (todayUsage >= maxDailyUsage) {
    throw new Error(`Daily usage limit (${maxDailyUsage}) exceeded. Try again tomorrow.`);
  }
}

async function logUsage(category) {
  try {
    const { dailyUsage = {}, categoryUsage = {} } = await chrome.storage.local.get(['dailyUsage', 'categoryUsage']);

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

    await chrome.storage.local.set({ dailyUsage, categoryUsage });

  } catch (error) {
    console.warn('Failed to log usage:', error);
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'generateMessage') {
    try {
      await chrome.action.openPopup();
    } catch (error) {
      console.log('Could not open popup programmatically');
    }
  }
});

// Error handling for unhandled promise rejections
self.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection in service worker:', event.reason);
});

// Chrome Side Panel API integration
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    console.log('Side panel opened for tab:', tab.id);
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

// Enable side panel behavior
try {
  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
  console.log('Side panel behavior configured');
} catch (error) {
  console.warn('Side panel configuration failed (Chrome version may not support it):', error);
}

console.log('Aletheia background service worker loaded');

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleGenerateRequest,
    makeAPIRequest,
    checkUsageLimit,
    logUsage
  };
}
