// Ascendia Extension Background Service Worker - Enhanced Security & Performance
// TypeScript version with comprehensive security hardening

// Security-first configuration with input validation
const CONFIG = {
  DEFAULT_API_URL: 'http://localhost:3000',
  ALLOWED_ORIGINS: [
    'http://localhost:3000',
    'https://ascendia.vercel.app',
    'https://*.vercel.app'
  ],
  API_ENDPOINTS: {
    generate: '/api/extension/generate',
    health: '/api/extension/generate'
  },
  TIMEOUT: 30000,
  MAX_RETRIES: 3,
  MAX_PAYLOAD_SIZE: 10000, // 10KB limit
  MAX_DAILY_USAGE: 100,
  ENCRYPTION: {
    ALGORITHM: 'AES-GCM',
    KEY_LENGTH: 256
  }
} as const;

// Type definitions for better type safety
interface GeneratePayload {
  profile?: {
    name?: string;
    headline?: string;
    location?: string;
    about?: string;
    experiences?: Array<{
      title: string;
      company?: string;
    }>;
    recentPosts?: string[];
    skills?: string[];
    profileUrl: string;
  };
  resume?: string;
  jd?: string;
  category: 'linkedin_connection' | 'cold_email' | 'linkedin_inmail';
  intent?: 'networking' | 'referral' | 'mentorship' | 'job_inquiry';
}

interface APIResponse {
  success: boolean;
  body?: string;
  subject_line?: string;
  error?: string;
  usage?: any;
  processingTime?: number;
}

interface SecurityContext {
  timestamp: number;
  origin: string;
  userId?: string;
  sessionId: string;
}

// Enhanced logging with security filtering
class SecureLogger {
  private static instance: SecureLogger;
  private sessionId: string;

  private constructor() {
    this.sessionId = crypto.randomUUID();
  }

  static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger();
    }
    return SecureLogger.instance;
  }

  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      // Remove potential API keys, tokens, or sensitive data
      return data.replace(/[a-zA-Z0-9]{32,}/g, '[REDACTED]')
                .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
                .replace(/api[_-]?key[=:]\s*[^\s&]+/gi, 'api_key=[REDACTED]');
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (['apiKey', 'token', 'authorization', 'key'].some(sensitive =>
            key.toLowerCase().includes(sensitive))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      sessionId: this.sessionId,
      message,
      data: data ? this.sanitizeData(data) : undefined
    };

    console[level](`[Ascendia-${level.toUpperCase()}]`, JSON.stringify(logEntry));
  }
}

// Input validation utilities
class InputValidator {
  static validatePayload(payload: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!payload || typeof payload !== 'object') {
      errors.push('Payload must be a valid object');
      return { valid: false, errors };
    }

    // Validate category
    const validCategories = ['linkedin_connection', 'cold_email', 'linkedin_inmail'];
    if (!payload.category || !validCategories.includes(payload.category)) {
      errors.push(`Category must be one of: ${validCategories.join(', ')}`);
    }

    // Validate payload size
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > CONFIG.MAX_PAYLOAD_SIZE) {
      errors.push(`Payload size (${payloadSize}) exceeds maximum allowed (${CONFIG.MAX_PAYLOAD_SIZE})`);
    }

    // Validate profile data if present
    if (payload.profile) {
      if (payload.profile.profileUrl && !this.isValidURL(payload.profile.profileUrl)) {
        errors.push('Profile URL is invalid');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  static isValidURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  static sanitizeString(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') return '';

    return input
      .trim()
      .slice(0, maxLength)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers
  }
}

// Enhanced security context manager
class SecurityManager {
  private static securityViolations: Array<{
    timestamp: number;
    violation: string;
    context: any;
  }> = [];

  static validateRequest(context: SecurityContext): boolean {
    const logger = SecureLogger.getInstance();

    // Rate limiting check
    const recentViolations = this.securityViolations.filter(
      v => Date.now() - v.timestamp < 60000 // 1 minute
    );

    if (recentViolations.length > 10) {
      logger.log('error', 'Too many security violations detected', { context });
      return false;
    }

    return true;
  }

  static reportViolation(violation: string, context: any): void {
    this.securityViolations.push({
      timestamp: Date.now(),
      violation,
      context
    });

    // Clean up old violations (keep last 1000)
    if (this.securityViolations.length > 1000) {
      this.securityViolations = this.securityViolations.slice(-1000);
    }
  }

  static validateAPIURL(url: string): boolean {
    try {
      const parsed = new URL(url);

      // Only allow HTTPS in production (except localhost)
      if (parsed.hostname !== 'localhost' && parsed.protocol !== 'https:') {
        return false;
      }

      // Check against allowed origins pattern
      return CONFIG.ALLOWED_ORIGINS.some(allowed => {
        if (allowed.includes('*')) {
          const pattern = allowed.replace(/\*/g, '.*');
          const regex = new RegExp(`^${pattern}$`);
          return regex.test(url);
        }
        return url.startsWith(allowed);
      });
    } catch {
      return false;
    }
  }
}

// Enhanced storage management with encryption considerations
class SecureStorage {
  private static readonly SENSITIVE_KEYS = ['apiKey', 'token', 'credentials'];

  static async getSecurely(keys: string | string[]): Promise<any> {
    try {
      const data = await chrome.storage.local.get(keys);

      // Log access (without sensitive data)
      const logger = SecureLogger.getInstance();
      const keysArray = Array.isArray(keys) ? keys : [keys];
      const nonSensitiveKeys = keysArray.filter(key =>
        !this.SENSITIVE_KEYS.some(sensitive => key.toLowerCase().includes(sensitive))
      );

      logger.log('info', 'Storage access', { keys: nonSensitiveKeys });

      return data;
    } catch (error) {
      const logger = SecureLogger.getInstance();
      logger.log('error', 'Storage access failed', { error: (error as Error).message });
      throw new Error('Failed to access secure storage');
    }
  }

  static async setSecurely(data: Record<string, any>): Promise<void> {
    try {
      // Validate data before storing
      const sanitizedData: Record<string, any> = {};

      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          sanitizedData[key] = InputValidator.sanitizeString(value);
        } else {
          sanitizedData[key] = value;
        }
      }

      await chrome.storage.local.set(sanitizedData);

      const logger = SecureLogger.getInstance();
      const nonSensitiveKeys = Object.keys(data).filter(key =>
        !this.SENSITIVE_KEYS.some(sensitive => key.toLowerCase().includes(sensitive))
      );
      logger.log('info', 'Storage update', { keys: nonSensitiveKeys });

    } catch (error) {
      const logger = SecureLogger.getInstance();
      logger.log('error', 'Storage update failed', { error: (error as Error).message });
      throw new Error('Failed to update secure storage');
    }
  }
}

// Installation and startup with enhanced security
chrome.runtime.onInstalled.addListener(async (details) => {
  const logger = SecureLogger.getInstance();
  logger.log('info', 'Extension installed', { reason: details.reason });

  if (details.reason === 'install') {
    await initializeDefaultSettings();
  }
});

chrome.runtime.onStartup.addListener(() => {
  const logger = SecureLogger.getInstance();
  logger.log('info', 'Extension started');
});

// Enhanced message handler with security validation
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const logger = SecureLogger.getInstance();
  const securityContext: SecurityContext = {
    timestamp: Date.now(),
    origin: sender.origin || 'unknown',
    sessionId: crypto.randomUUID()
  };

  // Validate security context
  if (!SecurityManager.validateRequest(securityContext)) {
    logger.log('error', 'Security validation failed', { context: securityContext });
    sendResponse({
      success: false,
      error: 'Security validation failed'
    });
    return false;
  }

  try {
    if (message.action === 'generate') {
      handleGenerateRequest(message.payload, securityContext)
        .then(result => sendResponse(result))
        .catch(error => {
          logger.log('error', 'Generate request failed', {
            error: error.message,
            context: securityContext
          });
          sendResponse({
            success: false,
            error: error.message || 'Generation failed'
          });
        });
      return true;
    }

    if (message.action === 'healthCheck') {
      handleHealthCheck(securityContext)
        .then(result => sendResponse(result))
        .catch(error => {
          logger.log('error', 'Health check failed', {
            error: error.message,
            context: securityContext
          });
          sendResponse({
            success: false,
            error: error.message || 'Health check failed'
          });
        });
      return true;
    }

    // Unknown action
    logger.log('warn', 'Unknown message action', { action: message.action, context: securityContext });
    sendResponse({
      success: false,
      error: 'Unknown action'
    });
    return false;

  } catch (error) {
    logger.log('error', 'Message handler error', {
      error: (error as Error).message,
      context: securityContext
    });
    sendResponse({
      success: false,
      error: 'Internal error'
    });
    return false;
  }
});

async function initializeDefaultSettings(): Promise<void> {
  const defaults = {
    apiKey: '',
    apiUrl: CONFIG.DEFAULT_API_URL,
    resume: '',
    accepted: [],
    dailyUsage: {},
    settings: {
      autoFillEnabled: true,
      showNotifications: true,
      maxDailyUsage: CONFIG.MAX_DAILY_USAGE,
      securityLevel: 'standard'
    }
  };

  await SecureStorage.setSecurely(defaults);

  const logger = SecureLogger.getInstance();
  logger.log('info', 'Default settings initialized', {
    apiUrl: CONFIG.DEFAULT_API_URL.replace(/\/\/.*@/, '//[REDACTED]@')
  });
}

// Enhanced generation handler with comprehensive security
async function handleGenerateRequest(payload: GeneratePayload, context: SecurityContext): Promise<APIResponse> {
  const logger = SecureLogger.getInstance();

  try {
    // Input validation
    const validation = InputValidator.validatePayload(payload);
    if (!validation.valid) {
      SecurityManager.reportViolation('Invalid payload', { errors: validation.errors, context });
      throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
    }

    // Get credentials securely
    const { apiKey, apiUrl } = await SecureStorage.getSecurely(['apiKey', 'apiUrl']);

    if (!apiKey) {
      throw new Error('API key not configured. Please set up your API key in extension settings.');
    }

    const targetUrl = apiUrl || CONFIG.DEFAULT_API_URL;

    // Validate API URL
    if (!SecurityManager.validateAPIURL(targetUrl)) {
      SecurityManager.reportViolation('Invalid API URL', { url: targetUrl, context });
      throw new Error('Invalid API URL configuration.');
    }

    logger.log('info', 'Starting generation request', {
      category: payload.category,
      context
    });

    // Check usage limits with enhanced security
    await checkUsageLimit();

    // Get accepted examples securely
    const { accepted = [] } = await SecureStorage.getSecurely(['accepted']);

    // Filter and sanitize examples
    const relevantExamples = accepted
      .filter((item: any) => item.category === payload.category)
      .map((item: any) => InputValidator.sanitizeString(item.body || item.message))
      .slice(-3);

    // Prepare secure request data
    const requestData = {
      profile: payload.profile ? {
        name: InputValidator.sanitizeString(payload.profile.name || ''),
        headline: InputValidator.sanitizeString(payload.profile.headline || ''),
        location: InputValidator.sanitizeString(payload.profile.location || ''),
        about: InputValidator.sanitizeString(payload.profile.about || '', 2000),
        experiences: payload.profile.experiences?.map(exp => ({
          title: InputValidator.sanitizeString(exp.title),
          company: InputValidator.sanitizeString(exp.company || '')
        })),
        recentPosts: payload.profile.recentPosts?.map(post =>
          InputValidator.sanitizeString(post, 300)),
        skills: payload.profile.skills?.map(skill =>
          InputValidator.sanitizeString(skill)),
        profileUrl: payload.profile.profileUrl
      } : undefined,
      resume: InputValidator.sanitizeString(payload.resume || '', 5000),
      jd: InputValidator.sanitizeString(payload.jd || '', 3000),
      category: payload.category,
      intent: payload.intent || 'networking',
      acceptedExamples: relevantExamples
    };

    // Make secure API request
    const response = await makeSecureAPIRequest('/api/extension/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-request-id': context.sessionId,
        'x-timestamp': context.timestamp.toString()
      },
      body: JSON.stringify(requestData)
    }, targetUrl, context);

    if (!response.success) {
      throw new Error(response.error || 'API request failed');
    }

    // Log successful generation (without sensitive data)
    await logUsage(payload.category, context);

    logger.log('info', 'Generation request completed', {
      category: payload.category,
      success: true,
      context
    });

    return response;

  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.log('error', 'Generation request failed', {
      error: errorMessage,
      context
    });

    // Enhanced error categorization
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      SecurityManager.reportViolation('Authentication failure', { context });
      throw new Error('Invalid API key. Please check your settings.');
    }

    if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
      SecurityManager.reportViolation('Rate limit exceeded', { context });
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    if (errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }

    if (errorMessage.includes('timeout')) {
      throw new Error('Request timeout. Please try again.');
    }

    throw new Error('Generation failed. Please try again.');
  }
}

// Enhanced API request function with security measures
async function makeSecureAPIRequest(
  endpoint: string,
  options: RequestInit = {},
  baseUrl: string,
  context: SecurityContext
): Promise<APIResponse> {
  const logger = SecureLogger.getInstance();

  if (!SecurityManager.validateAPIURL(baseUrl)) {
    throw new Error('Invalid API URL');
  }

  const url = baseUrl + endpoint;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      logger.log('info', 'API request attempt', {
        attempt,
        total: CONFIG.MAX_RETRIES,
        endpoint,
        context
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        // Add security headers
        headers: {
          ...options.headers,
          'X-Requested-With': 'Ascendia-Extension',
          'X-Extension-Version': chrome.runtime.getManifest().version
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      logger.log('info', 'API request successful', {
        endpoint,
        status: response.status,
        context
      });

      return data;

    } catch (error) {
      lastError = error as Error;

      logger.log('warn', 'API request attempt failed', {
        attempt,
        error: lastError.message,
        context
      });

      // Don't retry on certain errors
      if (lastError.name === 'AbortError') {
        throw new Error('Request timeout. Please try again.');
      }

      if (lastError.message.includes('401') || lastError.message.includes('403')) {
        SecurityManager.reportViolation('Authentication error', { error: lastError.message, context });
        throw lastError;
      }

      // Enhanced exponential backoff with jitter
      if (attempt < CONFIG.MAX_RETRIES) {
        const baseDelay = Math.pow(2, attempt) * 1000;
        const jitter = Math.random() * 1000; // Add randomization
        const delay = baseDelay + jitter;

        logger.log('info', 'Retrying after delay', {
          delay: Math.round(delay),
          attempt,
          context
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

// Enhanced health check with security validation
async function handleHealthCheck(context: SecurityContext): Promise<APIResponse> {
  const logger = SecureLogger.getInstance();

  try {
    const { apiKey, apiUrl } = await SecureStorage.getSecurely(['apiKey', 'apiUrl']);

    if (!apiKey) {
      return {
        success: false,
        error: 'API key not configured'
      };
    }

    const targetUrl = apiUrl || CONFIG.DEFAULT_API_URL;

    if (!SecurityManager.validateAPIURL(targetUrl)) {
      return {
        success: false,
        error: 'Invalid API URL configuration'
      };
    }

    const response = await makeSecureAPIRequest('/api/extension/generate', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey
      }
    }, targetUrl, context);

    logger.log('info', 'Health check successful', { context });

    return {
      success: true,
      data: response
    };

  } catch (error) {
    logger.log('error', 'Health check failed', {
      error: (error as Error).message,
      context
    });

    return {
      success: false,
      error: (error as Error).message
    };
  }
}

// Enhanced usage limit checking with security
async function checkUsageLimit(): Promise<void> {
  const { dailyUsage = {}, settings = {} } = await SecureStorage.getSecurely(['dailyUsage', 'settings']);

  const today = new Date().toISOString().split('T')[0];
  const todayUsage = dailyUsage[today] || 0;
  const maxDailyUsage = Math.min(settings.maxDailyUsage || CONFIG.MAX_DAILY_USAGE, CONFIG.MAX_DAILY_USAGE);

  if (todayUsage >= maxDailyUsage) {
    throw new Error(`Daily usage limit (${maxDailyUsage}) exceeded. Try again tomorrow.`);
  }
}

// Enhanced usage logging with privacy protection
async function logUsage(category: string, context: SecurityContext): Promise<void> {
  try {
    const { dailyUsage = {}, categoryUsage = {} } = await SecureStorage.getSecurely(['dailyUsage', 'categoryUsage']);

    const today = new Date().toISOString().split('T')[0];

    // Update daily usage
    dailyUsage[today] = (dailyUsage[today] || 0) + 1;

    // Update category usage
    if (!categoryUsage[today]) {
      categoryUsage[today] = {};
    }
    categoryUsage[today][category] = (categoryUsage[today][category] || 0) + 1;

    // Enhanced cleanup with security considerations
    const retentionDays = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffString = cutoffDate.toISOString().split('T')[0];

    // Clean up old data
    Object.keys(dailyUsage).forEach(date => {
      if (date < cutoffString) {
        delete dailyUsage[date];
      }
    });

    Object.keys(categoryUsage).forEach(date => {
      if (date < cutoffString) {
        delete categoryUsage[date];
      }
    });

    await SecureStorage.setSecurely({ dailyUsage, categoryUsage });

    const logger = SecureLogger.getInstance();
    logger.log('info', 'Usage logged', {
      category,
      todayUsage: dailyUsage[today],
      context
    });

  } catch (error) {
    const logger = SecureLogger.getInstance();
    logger.log('warn', 'Failed to log usage', {
      error: (error as Error).message,
      context
    });
    // Don't throw - usage logging is non-critical
  }
}

// Enhanced context menu with security
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: 'generateMessage',
      title: 'Generate message with Ascendia',
      contexts: ['selection'],
      documentUrlPatterns: ['https://www.linkedin.com/*']
    });

    const logger = SecureLogger.getInstance();
    logger.log('info', 'Context menu created');
  } catch (error) {
    const logger = SecureLogger.getInstance();
    logger.log('error', 'Failed to create context menu', { error: (error as Error).message });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const logger = SecureLogger.getInstance();

  if (info.menuItemId === 'generateMessage') {
    try {
      await chrome.action.openPopup();
      logger.log('info', 'Popup opened from context menu');
    } catch (error) {
      logger.log('warn', 'Could not open popup programmatically', {
        error: (error as Error).message
      });
    }
  }
});

// Enhanced error handling for unhandled promise rejections
self.addEventListener('unhandledrejection', event => {
  const logger = SecureLogger.getInstance();
  logger.log('error', 'Unhandled promise rejection in service worker', {
    reason: event.reason?.toString()
  });

  // Prevent the default browser behavior
  event.preventDefault();
});

// Enhanced error handling for general errors
self.addEventListener('error', event => {
  const logger = SecureLogger.getInstance();
  logger.log('error', 'Unhandled error in service worker', {
    message: event.error?.message,
    filename: event.filename,
    lineno: event.lineno
  });
});

const logger = SecureLogger.getInstance();
logger.log('info', 'Ascendia enhanced background service worker loaded', {
  version: chrome.runtime.getManifest().version,
  timestamp: Date.now()
});

// Export for testing (if needed) with type safety
declare global {
  var module: any;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleGenerateRequest,
    makeSecureAPIRequest,
    checkUsageLimit,
    logUsage,
    InputValidator,
    SecurityManager,
    SecureStorage,
    SecureLogger
  };
}