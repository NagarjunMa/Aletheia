// Ascendia Extension Background Service Worker
// Handles API communication with the Ascendia backend

// Extension configuration
const CONFIG = {
  DEFAULT_API_URL: 'http://localhost:3000', // Default for development
  API_ENDPOINTS: {
    generate: '/api/extension/generate',
    health: '/api/extension/generate'
  },
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3
};

// Installation and startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Ascendia extension installed:', details);

  // Set default settings on first install
  if (details.reason === 'install') {
    await initializeDefaultSettings();
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Ascendia extension started');
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'generate') {
    handleGenerateRequest(message.payload)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({
        success: false,
        error: error.message || 'Generation failed'
      }));

    return true; // Keep message channel open for async response
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

  // Handle other message types
  return false;
});

async function initializeDefaultSettings() {
  const defaults = {
    apiKey: '',
    apiUrl: CONFIG.DEFAULT_API_URL,
    resume: '',
    accepted: [],
    dailyUsage: {},
    settings: {
      autoFillEnabled: true,
      showNotifications: true,
      maxDailyUsage: 50
    }
  };

  await chrome.storage.local.set(defaults);
  console.log('Default settings initialized with API URL:', CONFIG.DEFAULT_API_URL);
}

async function handleGenerateRequest(payload) {
  try {
    // Get API key and URL from storage
    const { apiKey, apiUrl } = await chrome.storage.local.get(['apiKey', 'apiUrl']);

    if (!apiKey) {
      throw new Error('API key not configured. Please set up your API key in extension settings.');
    }

    console.log('Service Worker: Using API URL:', apiUrl || CONFIG.DEFAULT_API_URL);

    // Check daily usage limit
    await checkUsageLimit();

    // Get accepted examples for style learning
    const { accepted = [] } = await chrome.storage.local.get('accepted');

    // Filter relevant examples by category
    const relevantExamples = accepted
      .filter(item => item.category === payload.category)
      .map(item => item.body || item.message)
      .slice(-3); // Last 3 examples

    // Prepare request data
    const requestData = {
      ...payload,
      acceptedExamples: relevantExamples
    };

    // Make API request with retries
    const response = await makeAPIRequest('/api/extension/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(requestData)
    }, apiUrl);

    if (!response.success) {
      throw new Error(response.error || 'API request failed');
    }

    // Log successful generation
    await logUsage(payload.category);

    return response;

  } catch (error) {
    console.error('Generation request error:', error);

    // Handle specific error types
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      throw new Error('Invalid API key. Please check your settings.');
    }

    if (error.message.includes('429') || error.message.includes('Rate limit')) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }

    throw error;
  }
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
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('API request successful:', { endpoint, status: response.status });

      return data;

    } catch (error) {
      lastError = error;
      console.warn(`API request attempt ${attempt} failed:`, error.message);

      // Don't retry on certain errors
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please try again.');
      }

      if (error.message.includes('401') || error.message.includes('403')) {
        throw error; // Don't retry auth errors
      }

      // Wait before retry (exponential backoff)
      if (attempt < CONFIG.MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

async function handleHealthCheck() {
  try {
    const { apiKey, apiUrl } = await chrome.storage.local.get(['apiKey', 'apiUrl']);

    if (!apiKey) {
      return {
        success: false,
        error: 'API key not configured'
      };
    }

    const response = await makeAPIRequest('/api/extension/generate', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey
      }
    }, apiUrl);

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

    // Update daily usage
    dailyUsage[today] = (dailyUsage[today] || 0) + 1;

    // Update category usage
    if (!categoryUsage[today]) {
      categoryUsage[today] = {};
    }
    categoryUsage[today][category] = (categoryUsage[today][category] || 0) + 1;

    // Clean up old usage data (keep last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    Object.keys(dailyUsage).forEach(date => {
      if (date < cutoffDate) {
        delete dailyUsage[date];
      }
    });

    Object.keys(categoryUsage).forEach(date => {
      if (date < cutoffDate) {
        delete categoryUsage[date];
      }
    });

    await chrome.storage.local.set({ dailyUsage, categoryUsage });

  } catch (error) {
    console.warn('Failed to log usage:', error);
    // Don't throw - usage logging is non-critical
  }
}

// Context menu setup (optional feature)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'generateMessage',
    title: 'Generate message with Ascendia',
    contexts: ['selection'],
    documentUrlPatterns: ['https://www.linkedin.com/*']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'generateMessage') {
    // Open extension popup or send message to content script
    try {
      await chrome.action.openPopup();
    } catch (error) {
      console.log('Could not open popup programmatically');
      // Fallback: could show notification or inject content
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

console.log('Ascendia background service worker loaded');

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleGenerateRequest,
    makeAPIRequest,
    checkUsageLimit,
    logUsage
  };
}