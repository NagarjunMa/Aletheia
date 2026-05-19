// Aletheia Extension Popup JavaScript
// Main UI logic and user interaction handlers

let currentProfile = null;
let currentOutput = null;

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
  setupEventListeners();
  await checkLinkedInProfile();

  // Re-check profile when active tab URL changes or user switches tabs
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') checkLinkedInProfile();
  });
  chrome.tabs.onActivated.addListener(() => checkLinkedInProfile());

  // React to auth state changes (e.g., auth-bridge stores session while popup is open)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.aletheia_auth) {
      console.log('[POPUP] Auth state changed, reinitializing...');
      initializePopup().then(() => checkLinkedInProfile());
    }
  });
});

async function initializePopup() {
  console.log('[POPUP] initializePopup: checking auth status...');
  // Check auth status from storage first
  let authStatus = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getAuthStatus' }, resolve);
  });
  console.log('[POPUP] authStatus:', JSON.stringify(authStatus));

  // If not authenticated in storage, silently try to detect an existing web app session
  // (handles: logged in via web app, logged in from another window, etc.)
  if (!authStatus || !authStatus.authenticated) {
    console.log('[POPUP] No stored auth, silently checking for existing web session...');
    const silentResult = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'silentAuthCheck' }, resolve);
    });
    console.log('[POPUP] silentAuthCheck result:', JSON.stringify(silentResult));

    if (silentResult && silentResult.authenticated) {
      authStatus = silentResult;
    }
  }

  if (!authStatus || !authStatus.authenticated) {
    console.log('[POPUP] Not authenticated, showing auth required UI');
    showAuthRequired(authStatus);
    return;
  }

  // Show connected user badge
  showUserBadge(authStatus.user);

  // Load usage stats
  await updateUsageStats();

  // Set up character counter for JD input
  setupCharacterCounter();

  // Restore last generation if available
  await restoreLastGeneration();
}

function setupEventListeners() {
  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', openSettings);

  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', () => {
    checkLinkedInProfile(true);
  });

  // Generate button
  document.getElementById('generateBtn')?.addEventListener('click', generateMessage);

  // Copy buttons
  document.addEventListener('click', handleCopyClick);

  // Auto-fill button
  document.getElementById('fillBtn')?.addEventListener('click', autoFillMessage);

  // Feedback buttons
  document.getElementById('acceptBtn')?.addEventListener('click', () => handleFeedback('accept'));
  document.getElementById('rejectBtn')?.addEventListener('click', showRejectReasonPicker);

  // Rejection reason buttons (delegated)
  document.getElementById('reject-reason')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.reason-btn');
    if (!btn) return;
    const reason = btn.getAttribute('data-reason');
    handleFeedback('reject', reason === 'skip' ? undefined : reason);
  });

  // Category change handler
  document.getElementById('category')?.addEventListener('change', updateUIForCategory);

  // JD input change handler
  document.getElementById('jdInput')?.addEventListener('input', updateCharacterCount);
}

function showUserBadge(user) {
  const footer = document.querySelector('.footer');
  if (!footer) return;

  // Add user badge before usage stats
  const existingBadge = document.getElementById('userBadge');
  if (existingBadge) existingBadge.remove();

  const badge = document.createElement('div');
  badge.id = 'userBadge';
  badge.className = 'user-badge';
  badge.innerHTML = `
    <span class="user-email">${user?.email || user?.full_name || 'Connected'}</span>
    <button id="disconnectBtn" class="disconnect-btn" title="Disconnect">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16,17 21,12 16,7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    </button>
  `;

  footer.insertBefore(badge, footer.firstChild);

  document.getElementById('disconnectBtn').addEventListener('click', async () => {
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'logout' }, resolve);
    });
    if (result?.success) {
      window.location.reload();
    }
  });
}

function showAuthRequired(authStatus) {
  // Show auth prompt instead of main content
  document.getElementById('mainContent').innerHTML = `
    <div class="setup-required">
      <h3>Connect to Aletheia</h3>
      <p>Log in to the Aletheia web app, then click the button below to connect this extension to your account.</p>
      <button id="connectBtn" class="action-btn primary">Connect to Aletheia</button>
      <button id="openSettingsBtn" class="action-btn secondary" style="margin-top: 8px;">Open Settings</button>
      <div id="authError" class="error-message hidden" style="margin-top: 8px;">
        <span id="authErrorText"></span>
      </div>
    </div>
  `;
  document.getElementById('mainContent').classList.remove('hidden');

  document.getElementById('connectBtn').addEventListener('click', async () => {
    const btn = document.getElementById('connectBtn');
    btn.textContent = 'Connecting...';
    btn.disabled = true;
    console.log('[POPUP] Connect button clicked, sending authenticate message...');

    // Poll auth status as fallback (in case sendResponse is lost due to SW restart)
    let authResolved = false;
    const authPollInterval = setInterval(async () => {
      try {
        const status = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'getAuthStatus' }, resolve);
        });
        if (status?.authenticated) {
          clearInterval(authPollInterval);
          if (!authResolved) {
            authResolved = true;
            console.log('[POPUP] Auth detected via polling');
            btn.textContent = 'Connected!';
            setTimeout(() => window.location.reload(), 500);
          }
        }
      } catch (e) {
        // Service worker may be restarting, ignore
      }
    }, 2000);

    try {
      // The authenticate action may wait for the user to log in on the web app.
      // Show a "Waiting for login..." state after a brief delay.
      const waitingTimeout = setTimeout(() => {
        btn.textContent = 'Waiting for login...';
      }, 2000);

      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
          void chrome.runtime.lastError; // suppress "port closed" warning when SW dies
          console.log('[POPUP] authenticate response:', JSON.stringify(response));
          resolve(response);
        });
      });

      clearTimeout(waitingTimeout);

      if (authResolved) return; // Already handled by polling

      // SW was terminated while waiting (result is undefined/null).
      // Don't show error — let authPollInterval detect auth after SW recovery.
      if (!result) {
        chrome.storage.local.get('_loginPending', ({ _loginPending }) => {
          if (_loginPending && Date.now() < _loginPending.timeoutAt) {
            btn.textContent = 'Waiting for login...';
            // authPollInterval is still running; it will detect auth and reload
            return;
          }
          // No pending login or it has timed out
          clearInterval(authPollInterval);
          btn.textContent = 'Connect to Aletheia';
          btn.disabled = false;
          showError('Connection failed. Please try again.');
        });
        return;
      }

      authResolved = true;
      clearInterval(authPollInterval);

      if (result.success) {
        console.log('[POPUP] Authentication successful:', result.user?.email);
        btn.textContent = 'Connected!';
        // Brief delay so user sees success before reload
        setTimeout(() => window.location.reload(), 500);
      } else {
        console.error('[POPUP] Authentication failed:', result.error);
        btn.textContent = 'Connect to Aletheia';
        btn.disabled = false;
        const errorMsg = result.error?.includes('timed out')
          ? result.error
          : result.error || 'Connection failed. Please try again.';
        showError(errorMsg);
      }
    } catch (error) {
      clearInterval(authPollInterval);
      if (authResolved) return;
      console.error('[POPUP] authenticate threw:', error);
      btn.textContent = 'Connect to Aletheia';
      btn.disabled = false;
      showError('Connection failed. Please try again.');
    }
  });

  document.getElementById('openSettingsBtn').addEventListener('click', openSettings);
}

async function checkLinkedInProfile(forceRefresh = false) {
  const readingBanner = document.getElementById('readingProfile');
  const refreshIcon = document.querySelector('#refreshBtn .refresh-icon');

  // Reset banner state
  document.getElementById('profileBanner').classList.add('hidden');
  document.getElementById('noProfile').classList.add('hidden');
  readingBanner.style.display = 'flex';
  refreshIcon?.classList.add('spinning');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url?.includes('linkedin.com/in/')) {
      readingBanner.style.display = 'none';
      refreshIcon?.classList.remove('spinning');
      showNoProfile();
      return;
    }

    // Fix 6B: Content script retry — try sending, inject if not ready
    let response;
    const messageAction = forceRefresh ? 'reextractProfile' : 'getProfile';
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: messageAction });
    } catch (err) {
      // Content script not injected — try injecting it, then retry once
      console.log('[POPUP] Content script not ready, injecting...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/linkedin-reader.js']
        });
        await new Promise(r => setTimeout(r, 1500));
        response = await chrome.tabs.sendMessage(tab.id, { action: 'getProfile' });
      } catch (injectErr) {
        console.warn('[POPUP] Content script injection failed:', injectErr.message);
      }
    }

    readingBanner.style.display = 'none';
    refreshIcon?.classList.remove('spinning');

    if (response?.success && response.profile?.name) {
      currentProfile = response.profile;
      showProfileDetected(response.profile);
      enableMainContent();
    } else {
      showNoProfile();
    }
  } catch (error) {
    console.error('Error checking LinkedIn profile:', error);
    readingBanner.style.display = 'none';
    refreshIcon?.classList.remove('spinning');
    showNoProfile();
  }
}

function showProfileDetected(profile) {
  const banner = document.getElementById('profileBanner');
  const nameEl = document.getElementById('profileName');
  const roleEl = document.getElementById('profileRole');

  nameEl.textContent = profile.name;
  roleEl.textContent = profile.headline || 'LinkedIn Member';

  banner.classList.remove('hidden');
  document.getElementById('noProfile').classList.add('hidden');
}

function showNoProfile() {
  document.getElementById('noProfile').classList.remove('hidden');
  document.getElementById('profileBanner').classList.add('hidden');
  // Fix 5: Don't hide mainContent — just disable the generate button
  const btn = document.getElementById('generateBtn');
  if (btn) btn.disabled = true;
}

function enableMainContent() {
  document.getElementById('mainContent')?.classList.remove('hidden');
  const btn = document.getElementById('generateBtn');
  if (btn) btn.disabled = false;
}

async function generateMessage() {
  if (!currentProfile) {
    showError('No LinkedIn profile detected. Please navigate to a LinkedIn profile first.');
    return;
  }

  try {
    setGeneratingState(true);

    const jd = document.getElementById('jdInput').value.trim();
    const category = document.getElementById('category').value;
    const intent = document.getElementById('intent').value;

    const { resume, accepted = [] } = await chrome.storage.local.get(['resume', 'accepted']);

    const relevantExamples = accepted
      .filter(item => item.category === category)
      .map(item => item.body)
      .slice(-3);

    const response = await chrome.runtime.sendMessage({
      action: 'generate',
      payload: {
        profileMarkdown: currentProfile.profileMarkdown,
        profileUrl: currentProfile.profileUrl,
        resume: resume || '',
        jd,
        category,
        intent,
        acceptedExamples: relevantExamples
      }
    });

    if (response.success) {
      currentOutput = response;
      displayOutput(response);
      await storeGeneration(response);
      await incrementUsageCount();
    } else {
      const errMsg = response.error || 'Generation failed. Please try again.';
      if (isAuthError(errMsg)) {
        showAuthError(errMsg);
      } else {
        showError(errMsg);
      }
    }

  } catch (error) {
    console.error('Generation error:', error);
    const errMsg = error.message || 'Network error. Please check your connection and try again.';
    if (isAuthError(errMsg)) {
      showAuthError(errMsg);
    } else {
      showError('Network error. Please check your connection and try again.');
    }
  } finally {
    setGeneratingState(false);
  }
}

function displayOutput(output) {
  const outputSection = document.getElementById('output');
  const messageText = document.getElementById('messageText');
  const subjectLine = document.getElementById('subjectLine');
  const subjectText = document.getElementById('subjectText');

  let processedOutput = { ...output };

  if ((output.category === 'cold_email' || output.category === 'linkedin_inmail') &&
      typeof output.body === 'string') {
    try {
      let jsonString = output.body.trim();

      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      if (jsonString.startsWith('{') || jsonString.startsWith('"')) {
        const parsed = JSON.parse(jsonString);
        if (parsed.subject_line || parsed.body) {
          processedOutput.subject_line = parsed.subject_line || output.subject_line;
          processedOutput.body = parsed.body || output.body;
        }
      }
    } catch (e) {
      console.warn('Failed to parse JSON response:', e);
    }
  }

  const messageBody = processedOutput.body || processedOutput.message || '';
  messageText.textContent = messageBody;

  updateCharacterCountDisplay(messageBody, processedOutput.category);

  if (processedOutput.subject_line) {
    subjectText.textContent = processedOutput.subject_line;
    subjectLine.classList.remove('hidden');
  } else {
    subjectLine.classList.add('hidden');
  }

  displayValidationFeedback(processedOutput);

  outputSection.classList.remove('hidden');
  hideError();
}

function updateCharacterCountDisplay(text, category) {
  const charCount = text.length;
  const messageCharCount = document.getElementById('messageCharCount');

  if (!messageCharCount) return;

  let isOverLimit, displayText;

  switch (category) {
    case 'linkedin_connection':
      isOverLimit = charCount > 280;
      displayText = `${charCount}/300`;
      break;
    case 'linkedin_inmail':
      isOverLimit = charCount > 1800;
      displayText = `${charCount} chars`;
      break;
    case 'cold_email':
      isOverLimit = charCount > 1500;
      displayText = `${charCount} chars`;
      break;
    default:
      displayText = `${charCount} chars`;
      isOverLimit = false;
  }

  messageCharCount.textContent = displayText;

  messageCharCount.className = 'char-count-display';
  if (isOverLimit) {
    messageCharCount.classList.add('over-limit');
    messageCharCount.style.color = 'var(--warning-400)';
    messageCharCount.style.borderColor = 'var(--warning-400)';
  } else if (category === 'linkedin_connection' && charCount > 250) {
    messageCharCount.classList.add('near-limit');
    messageCharCount.style.color = 'var(--warning-500)';
    messageCharCount.style.borderColor = 'var(--warning-500)';
  } else {
    messageCharCount.style.color = 'var(--success-400)';
    messageCharCount.style.borderColor = 'var(--success-400)';
  }
}

function setGeneratingState(isGenerating) {
  const generateBtn = document.getElementById('generateBtn');
  const generateText = document.getElementById('generateText');
  const generateSpinner = document.getElementById('generateSpinner');

  generateBtn.disabled = isGenerating;

  if (isGenerating) {
    generateText.textContent = 'Generating...';
    generateSpinner.classList.remove('hidden');
  } else {
    generateText.textContent = 'Generate Message';
    generateSpinner.classList.add('hidden');
  }
}

function handleCopyClick(event) {
  const copyBtn = event.target.closest('.copy-btn');
  if (!copyBtn) return;

  const copyType = copyBtn.getAttribute('data-copy');
  let textToCopy = '';

  if (copyType === 'subject') {
    textToCopy = document.getElementById('subjectText').textContent;
  } else if (copyType === 'body') {
    textToCopy = document.getElementById('messageText').textContent;
  }

  if (textToCopy) {
    copyToClipboardWithFeedback(textToCopy, copyBtn, 'Copied!');
  }
}

document.getElementById('copyAllBtn')?.addEventListener('click', () => {
  if (!currentOutput) return;

  let textToCopy = '';

  if (currentOutput.subject_line) {
    textToCopy = `Subject: ${currentOutput.subject_line}\n\n${currentOutput.body}`;
  } else {
    textToCopy = currentOutput.body;
  }

  copyToClipboardWithFeedback(textToCopy, document.getElementById('copyAllBtn'), 'All Copied!');
});

async function copyToClipboardWithFeedback(text, buttonElement, successMessage) {
  if (!text) return;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showCopySuccess(buttonElement, successMessage);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.cssText = `
      position: fixed;
      top: -1000px;
      left: -1000px;
      width: 1px;
      height: 1px;
      padding: 0;
      border: none;
      outline: none;
      box-shadow: none;
      background: transparent;
    `;

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      showCopySuccess(buttonElement, successMessage);
    } else {
      throw new Error('Copy command failed');
    }

  } catch (error) {
    console.error('Copy failed:', error);
    showCopyError(buttonElement, 'Copy failed');
  }
}

function showCopySuccess(buttonElement, message) {
  const originalText = buttonElement.textContent || buttonElement.innerHTML;
  const originalIcon = buttonElement.querySelector('.copy-icon');

  buttonElement.classList.add('copy-success');
  if (originalIcon) {
    originalIcon.style.display = 'none';
  }

  const successIcon = document.createElement('span');
  successIcon.innerHTML = '✓';
  successIcon.style.color = 'var(--success-400)';
  buttonElement.appendChild(successIcon);

  const textElement = buttonElement.querySelector('.btn-icon') || buttonElement.firstChild;
  if (textElement && textElement.nodeType === 3) {
    textElement.textContent = message;
  } else {
    buttonElement.setAttribute('title', message);
  }

  setTimeout(() => {
    buttonElement.classList.remove('copy-success');
    if (originalIcon) {
      originalIcon.style.display = '';
    }
    if (successIcon.parentNode) {
      successIcon.remove();
    }

    if (textElement && textElement.nodeType === 3) {
      textElement.textContent = originalText;
    } else {
      buttonElement.innerHTML = originalText;
    }
  }, 1500);
}

function showCopyError(buttonElement, message) {
  const originalText = buttonElement.textContent;

  buttonElement.style.color = 'var(--error-400)';
  buttonElement.textContent = message;

  setTimeout(() => {
    buttonElement.style.color = '';
    buttonElement.textContent = originalText;
  }, 2000);
}

async function autoFillMessage() {
  if (!currentOutput) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.tabs.sendMessage(tab.id, {
      action: 'autoFill',
      data: currentOutput
    });

    showTemporaryFeedback(document.getElementById('fillBtn'), 'Filled!');
  } catch (error) {
    console.error('Auto-fill error:', error);
    showError('Could not auto-fill. Make sure you\'re on the right page.');
  }
}

function showRejectReasonPicker() {
  const rejectReason = document.getElementById('reject-reason');
  if (rejectReason) rejectReason.classList.remove('hidden');
}

async function handleFeedback(type, rejectionReason) {
  if (!currentOutput) return;

  // Hide reason picker if visible
  document.getElementById('reject-reason')?.classList.add('hidden');

  const category = document.getElementById('category').value;
  const messageBody = currentOutput.body || currentOutput.message || '';

  const evalMetadata = currentOutput.evalMetadata || undefined;

  if (type === 'accept') {
    await saveAcceptedMessage();
    showTemporaryFeedback(document.getElementById('acceptBtn'), 'Saved!');
    chrome.runtime.sendMessage({
      action: 'sendFeedback',
      payload: {
        message: messageBody,
        category,
        approved: true,
        subjectLine: currentOutput.subject_line || undefined,
        ...(evalMetadata ? { evalMetadata } : {}),
      }
    }).catch(() => {});
  } else if (type === 'reject') {
    chrome.runtime.sendMessage({
      action: 'sendFeedback',
      payload: {
        message: messageBody,
        category,
        approved: false,
        ...(rejectionReason ? { rejectionReason } : {}),
        ...(evalMetadata ? { evalMetadata } : {}),
      }
    }).catch(() => {});
    await generateMessage();
  }
}

async function saveAcceptedMessage() {
  const { accepted = [] } = await chrome.storage.local.get('accepted');

  const feedbackData = {
    ...currentOutput,
    category: document.getElementById('category').value,
    intent: document.getElementById('intent').value,
    timestamp: Date.now(),
    profileName: currentProfile?.name || 'Unknown'
  };

  accepted.push(feedbackData);

  const recentAccepted = accepted.slice(-20);

  await chrome.storage.local.set({ accepted: recentAccepted });
}

function updateUIForCategory() {
  const category = document.getElementById('category').value;

  const buttonText = {
    'linkedin_connection': 'Generate Connection Request',
    'cold_email': 'Generate Cold Email',
    'linkedin_inmail': 'Generate InMail'
  };

  document.getElementById('generateText').textContent = buttonText[category] || 'Generate Message';
}

function setupCharacterCounter() {
  const jdInput = document.getElementById('jdInput');
  const charCount = document.getElementById('jdCharCount');

  jdInput.addEventListener('input', () => {
    charCount.textContent = jdInput.value.length;
  });
}

function updateCharacterCount() {
  const jdInput = document.getElementById('jdInput');
  const charCount = document.getElementById('jdCharCount');
  charCount.textContent = jdInput.value.length;
}

async function updateUsageStats() {
  const { dailyUsage = {} } = await chrome.storage.local.get('dailyUsage');
  const today = new Date().toISOString().split('T')[0];
  const todayCount = dailyUsage[today] || 0;

  document.getElementById('usageCount').textContent = todayCount;
}

async function incrementUsageCount() {
  const { dailyUsage = {} } = await chrome.storage.local.get('dailyUsage');
  const today = new Date().toISOString().split('T')[0];

  dailyUsage[today] = (dailyUsage[today] || 0) + 1;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  Object.keys(dailyUsage).forEach(date => {
    if (new Date(date) < thirtyDaysAgo) {
      delete dailyUsage[date];
    }
  });

  await chrome.storage.local.set({ dailyUsage });
  await updateUsageStats();
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');

  if (!errorEl || !errorText) {
    // Elements don't exist (e.g. auth screen is showing) — try inline auth error
    const authErrorEl = document.getElementById('authError');
    const authErrorText = document.getElementById('authErrorText');
    if (authErrorEl && authErrorText) {
      authErrorText.textContent = message;
      authErrorEl.classList.remove('hidden');
      setTimeout(() => authErrorEl.classList.add('hidden'), 5000);
    } else {
      console.warn('showError: error elements not in DOM:', message);
    }
    return;
  }

  errorText.textContent = message;
  errorEl.classList.remove('hidden');

  setTimeout(hideError, 5000);
}

function hideError() {
  document.getElementById('errorMessage')?.classList.add('hidden');
}

function isAuthError(message) {
  if (!message) return false;
  return message.startsWith('AUTH_FAILED:') ||
    message.includes('Not authenticated') ||
    message.includes('Session expired');
}

function showAuthError(message) {
  const errorEl = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');

  if (!errorEl || !errorText) {
    console.warn('showAuthError: error elements not in DOM:', message);
    return;
  }

  // Strip the AUTH_FAILED: prefix for display
  const displayMsg = message.replace(/^AUTH_FAILED:\s*/, '');

  errorText.innerHTML = '';
  errorText.textContent = displayMsg + ' ';

  const reauthBtn = document.createElement('button');
  reauthBtn.className = 'reauth-btn';
  reauthBtn.textContent = 'Re-authenticate';
  reauthBtn.addEventListener('click', async () => {
    reauthBtn.textContent = 'Connecting...';
    reauthBtn.disabled = true;
    try {
      // Clear stale auth first so handleAuthenticate() opens login tab
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'logout' }, resolve);
      });
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'authenticate' }, resolve);
      });
      if (result?.success) {
        hideError();
        await initializePopup();
        await checkLinkedInProfile();
      } else {
        reauthBtn.textContent = 'Re-authenticate';
        reauthBtn.disabled = false;
        showError(result?.error || 'Re-authentication failed. Please try again.');
      }
    } catch (err) {
      reauthBtn.textContent = 'Re-authenticate';
      reauthBtn.disabled = false;
      showError('Re-authentication failed. Please try again.');
    }
  });

  errorText.appendChild(reauthBtn);
  errorEl.classList.remove('hidden');
  // Don't auto-hide auth errors — user needs to take action
}

function showTemporaryFeedback(element, text) {
  const originalText = element.textContent;
  element.textContent = text;

  setTimeout(() => {
    element.textContent = originalText;
  }, 2000);
}

function displayValidationFeedback(output) {
  const existingFeedback = document.querySelector('.validation-feedback');
  if (existingFeedback) existingFeedback.remove();

  const feedbackContainer = document.createElement('div');
  feedbackContainer.className = 'validation-feedback';

  const validation = output.validation || {};
  const category = output.category;
  let feedbackItems = [];

  if (category === 'linkedin_connection') {
    const charCount = output.character_count || 0;
    const isWithinLimit = charCount <= 280;

    feedbackItems.push({
      icon: isWithinLimit ? '✅' : '⚠️',
      text: `${charCount}/280 characters`,
      status: isWithinLimit ? 'success' : 'warning',
      details: isWithinLimit ? 'Within LinkedIn limit' : 'Exceeds LinkedIn character limit'
    });

    if (validation.truncated) {
      feedbackItems.push({
        icon: '✂️',
        text: 'Message was truncated',
        status: 'warning',
        details: `Original length: ${validation.original_length} characters`
      });
    }
  }

  if (category === 'cold_email' || category === 'linkedin_inmail') {
    const wordCount = output.word_count || 0;
    const maxWords = category === 'cold_email' ? 150 : 120;
    const minWords = category === 'cold_email' ? 100 : 80;
    const isWithinRange = wordCount >= minWords && wordCount <= maxWords;

    feedbackItems.push({
      icon: isWithinRange ? '✅' : wordCount > maxWords ? '⚠️' : 'ℹ️',
      text: `${wordCount}/${maxWords} words`,
      status: isWithinRange ? 'success' : wordCount > maxWords ? 'warning' : 'info',
      details: `Recommended: ${minWords}-${maxWords} words`
    });

    if (validation.fallback_parsing) {
      feedbackItems.push({
        icon: '⚠️',
        text: 'Format validation skipped',
        status: 'warning',
        details: 'Response format could not be validated'
      });
    }
  }

  if (validation.sanitization_applied) {
    feedbackItems.push({
      icon: '🛡️',
      text: 'AI-language removed',
      status: 'info',
      details: 'Corporate clichés and AI-sounding phrases were filtered out'
    });
  }

  if (validation.character_limit_passed || validation.word_limit_passed) {
    feedbackItems.push({
      icon: '🎯',
      text: 'Platform optimized',
      status: 'success',
      details: 'Message follows platform best practices'
    });
  }

  if (feedbackItems.length > 0) {
    const header = document.createElement('div');
    header.className = 'validation-header';

    const title = document.createElement('span');
    title.className = 'validation-title';
    title.textContent = '📊 Message Analysis';
    header.appendChild(title);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'validation-toggle';
    toggleBtn.textContent = 'Details';
    toggleBtn.onclick = toggleValidationDetails;
    header.appendChild(toggleBtn);

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'validation-items';

    for (const item of feedbackItems) {
      const itemEl = document.createElement('div');
      itemEl.className = `validation-item ${item.status}`;

      const iconEl = document.createElement('span');
      iconEl.className = 'validation-icon';
      iconEl.textContent = item.icon;
      itemEl.appendChild(iconEl);

      const textEl = document.createElement('span');
      textEl.className = 'validation-text';
      textEl.textContent = item.text;
      itemEl.appendChild(textEl);

      const detailsEl = document.createElement('span');
      detailsEl.className = 'validation-details hidden';
      detailsEl.textContent = item.details;
      itemEl.appendChild(detailsEl);

      itemsContainer.appendChild(itemEl);
    }

    feedbackContainer.appendChild(header);
    feedbackContainer.appendChild(itemsContainer);

    const messageBody = document.getElementById('messageBody');
    messageBody.insertAdjacentElement('afterend', feedbackContainer);
  }
}

function toggleValidationDetails() {
  const details = document.querySelectorAll('.validation-details');
  const toggleBtn = document.querySelector('.validation-toggle');

  const isHidden = details[0]?.classList.contains('hidden');

  details.forEach(detail => {
    if (isHidden) {
      detail.classList.remove('hidden');
    } else {
      detail.classList.add('hidden');
    }
  });

  toggleBtn.textContent = isHidden ? 'Hide' : 'Details';
}

async function storeGeneration(output) {
  try {
    const generationData = {
      output,
      timestamp: Date.now(),
      profile: currentProfile,
      inputs: {
        jd: document.getElementById('jdInput').value.trim(),
        category: document.getElementById('category').value,
        intent: document.getElementById('intent').value
      }
    };

    await chrome.storage.local.set({ lastGeneration: generationData });
  } catch (error) {
    console.error('Error storing generation:', error);
  }
}

async function restoreLastGeneration() {
  try {
    const { lastGeneration } = await chrome.storage.local.get('lastGeneration');

    if (!lastGeneration) return;

    const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
    if (lastGeneration.timestamp < fourHoursAgo) {
      await chrome.storage.local.remove('lastGeneration');
      return;
    }

    if (lastGeneration.inputs) {
      document.getElementById('jdInput').value = lastGeneration.inputs.jd || '';
      document.getElementById('category').value = lastGeneration.inputs.category || 'linkedin_connection';
      document.getElementById('intent').value = lastGeneration.inputs.intent || 'networking';

      updateCharacterCount();
      updateUIForCategory();
    }

    if (lastGeneration.output) {
      currentOutput = lastGeneration.output;
      displayOutput(lastGeneration.output);
    }

    showTemporaryMessage('Previous session restored', 'info');

  } catch (error) {
    console.error('Error restoring generation:', error);
  }
}

function showTemporaryMessage(message, type = 'info') {
  const messageEl = document.createElement('div');
  messageEl.className = `temp-message ${type}`;
  messageEl.textContent = message;
  messageEl.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--accent-500);
    font-size: 12px;
    z-index: 1000;
    animation: slideInOut 3s ease-in-out forwards;
  `;

  document.body.appendChild(messageEl);

  setTimeout(() => {
    messageEl.remove();
  }, 3000);
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'profileUpdated') {
    currentProfile = message.profile;
    if (message.profile) {
      showProfileDetected(message.profile);
      enableMainContent();
    } else {
      showNoProfile();
    }
  }
});
