// Ascendia Extension Popup JavaScript
// Main UI logic and user interaction handlers

let currentProfile = null;
let currentOutput = null;

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
  setupEventListeners();
  await checkLinkedInProfile();
});

async function initializePopup() {
  // Load user settings
  const { apiKey, resume } = await chrome.storage.local.get(['apiKey', 'resume']);

  // Check if user needs to set up API key
  if (!apiKey) {
    showSetupRequired();
    return;
  }

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

  // Generate button
  document.getElementById('generateBtn').addEventListener('click', generateMessage);

  // Copy buttons
  document.addEventListener('click', handleCopyClick);

  // Auto-fill button
  document.getElementById('fillBtn')?.addEventListener('click', autoFillMessage);

  // Feedback buttons
  document.getElementById('acceptBtn')?.addEventListener('click', () => handleFeedback('accept'));
  document.getElementById('rejectBtn')?.addEventListener('click', () => handleFeedback('reject'));

  // Category change handler
  document.getElementById('category').addEventListener('change', updateUIForCategory);

  // JD input change handler
  document.getElementById('jdInput').addEventListener('input', updateCharacterCount);
}

async function checkLinkedInProfile() {
  try {
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url?.includes('linkedin.com/in/')) {
      showNoProfile();
      return;
    }

    // Request profile data from content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getProfile' });

    if (response?.success && response.profile?.name) {
      currentProfile = response.profile;
      showProfileDetected(response.profile);
      enableMainContent();
    } else {
      showNoProfile();
    }
  } catch (error) {
    console.error('Error checking LinkedIn profile:', error);
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
  document.getElementById('mainContent').classList.add('hidden');
}

function enableMainContent() {
  document.getElementById('mainContent').classList.remove('hidden');
  document.getElementById('generateBtn').disabled = false;
}

function showSetupRequired() {
  // Show setup message instead of main content
  document.getElementById('mainContent').innerHTML = `
    <div class="setup-required">
      <h3>Setup Required</h3>
      <p>Please configure your API key and resume in settings to start generating messages.</p>
      <button id="openSettingsBtn" class="action-btn primary">Open Settings</button>
    </div>
  `;

  document.getElementById('openSettingsBtn').addEventListener('click', openSettings);
}

async function generateMessage() {
  if (!currentProfile) {
    showError('No LinkedIn profile detected. Please navigate to a LinkedIn profile first.');
    return;
  }

  try {
    setGeneratingState(true);

    // Get user inputs
    const jd = document.getElementById('jdInput').value.trim();
    const category = document.getElementById('category').value;
    const intent = document.getElementById('intent').value;

    // Get user data
    const { apiKey, resume, accepted = [] } = await chrome.storage.local.get(['apiKey', 'resume', 'accepted']);

    if (!apiKey) {
      showError('API key not configured. Please check settings.');
      return;
    }

    // Filter relevant accepted examples
    const relevantExamples = accepted
      .filter(item => item.category === category)
      .map(item => item.body)
      .slice(-3); // Last 3 examples

    // Send generation request to background script
    const response = await chrome.runtime.sendMessage({
      action: 'generate',
      payload: {
        profile: currentProfile,
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
      showError(response.error || 'Generation failed. Please try again.');
    }

  } catch (error) {
    console.error('Generation error:', error);
    showError('Network error. Please check your connection and try again.');
  } finally {
    setGeneratingState(false);
  }
}

function displayOutput(output) {
  const outputSection = document.getElementById('output');
  const messageText = document.getElementById('messageText');
  const subjectLine = document.getElementById('subjectLine');
  const subjectText = document.getElementById('subjectText');
  const messageCharCount = document.getElementById('messageCharCount');

  // Parse JSON response if needed for cold_email and linkedin_inmail
  let processedOutput = { ...output };

  if ((output.category === 'cold_email' || output.category === 'linkedin_inmail') &&
      typeof output.body === 'string') {
    try {
      // Check if body is actually a JSON string
      if (output.body.trim().startsWith('{') || output.body.trim().startsWith('"')) {
        const parsed = JSON.parse(output.body);

        // If parsed successfully and contains the expected structure
        if (parsed.subject_line || parsed.body) {
          processedOutput.subject_line = parsed.subject_line || output.subject_line;
          processedOutput.body = parsed.body || output.body;
          console.log('Successfully parsed JSON response:', parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to parse JSON response, using as-is:', e);
      // Continue with original output if parsing fails
    }
  }

  // Display message body
  const messageBody = processedOutput.body || processedOutput.message || '';
  messageText.textContent = messageBody;

  // Display character count with appropriate styling
  updateCharacterCountDisplay(messageBody, processedOutput.category);

  // Display subject line if it exists (for emails)
  if (processedOutput.subject_line) {
    subjectText.textContent = processedOutput.subject_line;
    subjectLine.classList.remove('hidden');
  } else {
    subjectLine.classList.add('hidden');
  }

  // Display validation feedback
  displayValidationFeedback(processedOutput);

  // Show output section
  outputSection.classList.remove('hidden');
  hideError();
}

// Update character count display with platform-specific limits
function updateCharacterCountDisplay(text, category) {
  const charCount = text.length;
  const messageCharCount = document.getElementById('messageCharCount');

  if (!messageCharCount) return;

  let limit, isOverLimit, displayText;

  // Platform-specific limits
  switch (category) {
    case 'linkedin_connection':
      limit = 300; // LinkedIn connection request limit
      isOverLimit = charCount > 280; // Warning threshold
      displayText = `${charCount}/300`;
      break;
    case 'linkedin_inmail':
      limit = 2000; // LinkedIn InMail limit (approximate)
      isOverLimit = charCount > 1800;
      displayText = `${charCount} chars`;
      break;
    case 'cold_email':
      limit = 2000; // Email limit (flexible)
      isOverLimit = charCount > 1500;
      displayText = `${charCount} chars`;
      break;
    default:
      displayText = `${charCount} chars`;
      isOverLimit = false;
  }

  // Update display
  messageCharCount.textContent = displayText;

  // Style based on limits
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

// Enhanced clipboard function with fallback and proper feedback
async function copyToClipboardWithFeedback(text, buttonElement, successMessage) {
  if (!text) return;

  try {
    // Primary method: modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showCopySuccess(buttonElement, successMessage);
      return;
    }

    // Fallback method: legacy document.execCommand
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

// Show copy success feedback with auto-close protection
function showCopySuccess(buttonElement, message) {
  const originalText = buttonElement.textContent || buttonElement.innerHTML;
  const originalIcon = buttonElement.querySelector('.copy-icon');

  // Update button appearance
  buttonElement.classList.add('copy-success');
  if (originalIcon) {
    originalIcon.style.display = 'none';
  }

  // Show success message
  const successIcon = document.createElement('span');
  successIcon.innerHTML = '✓';
  successIcon.style.color = 'var(--success-400)';
  buttonElement.appendChild(successIcon);

  const textElement = buttonElement.querySelector('.btn-icon') || buttonElement.firstChild;
  if (textElement && textElement.nodeType === 3) { // Text node
    textElement.textContent = message;
  } else {
    buttonElement.setAttribute('title', message);
  }

  // Prevent popup from closing immediately
  setTimeout(() => {
    // Restore original state
    buttonElement.classList.remove('copy-success');
    if (originalIcon) {
      originalIcon.style.display = '';
    }
    if (successIcon.parentNode) {
      successIcon.remove();
    }

    // Restore original text/content
    if (textElement && textElement.nodeType === 3) {
      textElement.textContent = originalText;
    } else {
      buttonElement.innerHTML = originalText;
    }
  }, 1500); // Visible for 1.5 seconds
}

// Show copy error feedback
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

async function handleFeedback(type) {
  if (!currentOutput) return;

  if (type === 'accept') {
    await saveAcceptedMessage();
    showTemporaryFeedback(document.getElementById('acceptBtn'), 'Saved!');
  } else if (type === 'reject') {
    // Regenerate with different parameters
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

  // Keep only last 20 accepted messages to avoid storage bloat
  const recentAccepted = accepted.slice(-20);

  await chrome.storage.local.set({ accepted: recentAccepted });
}

function updateUIForCategory() {
  const category = document.getElementById('category').value;
  const generateBtn = document.getElementById('generateBtn');

  // Update button text based on category
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

  // Clean up old usage data (keep last 30 days)
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

  errorText.textContent = message;
  errorEl.classList.remove('hidden');

  // Auto-hide after 5 seconds
  setTimeout(hideError, 5000);
}

function hideError() {
  document.getElementById('errorMessage').classList.add('hidden');
}

function showTemporaryFeedback(element, text) {
  const originalText = element.textContent;
  element.textContent = text;

  setTimeout(() => {
    element.textContent = originalText;
  }, 2000);
}

function displayValidationFeedback(output) {
  // Remove any existing validation feedback
  const existingFeedback = document.querySelector('.validation-feedback');
  if (existingFeedback) {
    existingFeedback.remove();
  }

  // Create validation feedback container
  const feedbackContainer = document.createElement('div');
  feedbackContainer.className = 'validation-feedback';

  const validation = output.validation || {};
  const category = output.category;
  let feedbackItems = [];

  // Character/Word count feedback
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

  // Sanitization feedback
  if (validation.sanitization_applied) {
    feedbackItems.push({
      icon: '🛡️',
      text: 'AI-language removed',
      status: 'info',
      details: 'Corporate clichés and AI-sounding phrases were filtered out'
    });
  }

  // Quality indicators
  if (validation.character_limit_passed || validation.word_limit_passed) {
    feedbackItems.push({
      icon: '🎯',
      text: 'Platform optimized',
      status: 'success',
      details: 'Message follows platform best practices'
    });
  }

  // Build feedback HTML
  if (feedbackItems.length > 0) {
    const feedbackHTML = `
      <div class="validation-header">
        <span class="validation-title">📊 Message Analysis</span>
        <button class="validation-toggle" onclick="toggleValidationDetails()">Details</button>
      </div>
      <div class="validation-items">
        ${feedbackItems.map(item => `
          <div class="validation-item ${item.status}">
            <span class="validation-icon">${item.icon}</span>
            <span class="validation-text">${item.text}</span>
            <span class="validation-details hidden">${item.details}</span>
          </div>
        `).join('')}
      </div>
    `;

    feedbackContainer.innerHTML = feedbackHTML;

    // Insert after the message body
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

// Store generated message for persistence
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

// Restore last generation when popup opens
async function restoreLastGeneration() {
  try {
    const { lastGeneration } = await chrome.storage.local.get('lastGeneration');

    if (!lastGeneration) return;

    // Check if generation is recent (within last 4 hours)
    const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
    if (lastGeneration.timestamp < fourHoursAgo) {
      // Clean up old generation
      await chrome.storage.local.remove('lastGeneration');
      return;
    }

    // Restore inputs
    if (lastGeneration.inputs) {
      document.getElementById('jdInput').value = lastGeneration.inputs.jd || '';
      document.getElementById('category').value = lastGeneration.inputs.category || 'linkedin_connection';
      document.getElementById('intent').value = lastGeneration.inputs.intent || 'networking';

      // Update character count
      updateCharacterCount();
      updateUIForCategory();
    }

    // Restore output if available
    if (lastGeneration.output) {
      currentOutput = lastGeneration.output;
      displayOutput(lastGeneration.output);
    }

    // Show restoration indicator
    showTemporaryMessage('Previous session restored', 'info');

  } catch (error) {
    console.error('Error restoring generation:', error);
  }
}

// Show temporary message to user
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