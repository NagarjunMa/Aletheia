// LinkedIn Profile Reader Content Script
// Extracts LinkedIn profile text via innerText — no CSS selectors, no external libraries.
// This approach is immune to LinkedIn DOM/class changes.

(function() {
  'use strict';

  let lastExtractedProfile = null;
  let extractionTimeout = null;

  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProfileReader);
  } else {
    initializeProfileReader();
  }

  function initializeProfileReader() {
    console.log('LinkedIn Reader: Initializing on page:', window.location.href);

    if (!isLinkedInProfilePage()) {
      console.log('LinkedIn Reader: Not a LinkedIn profile page, exiting');
      return;
    }

    console.log('LinkedIn Reader: On LinkedIn profile page, setting up extraction');

    // Wait for dynamic content, then extract
    setTimeout(() => { extractAndNotifyProfile(); }, 1500);
    extractAndNotifyProfile();

    observeProfileChanges();
    chrome.runtime.onMessage.addListener(handleMessage);

    console.log('LinkedIn Reader: Setup complete');
  }

  function isLinkedInProfilePage() {
    return window.location.pathname.startsWith('/in/') &&
           window.location.hostname.includes('linkedin.com');
  }

  function extractLinkedInProfile() {
    try {
      console.log('LinkedIn Reader: Starting extraction...');

      // Extract name from page title — far more stable than CSS selectors.
      // LinkedIn title format: "John Smith - Software Engineer | LinkedIn"
      const rawTitle = document.title || '';
      const name = rawTitle.split(' - ')[0].replace(' | LinkedIn', '').trim() || null;

      if (!name) {
        console.log('LinkedIn Reader: Could not extract name from document.title:', rawTitle);
        return null;
      }

      // Extract plain text from the main profile content area.
      // innerText requires no external library, is selector-independent,
      // and produces clean readable text Claude can parse directly.
      const mainEl = document.querySelector('main') || document.body;
      const profileMarkdown = (mainEl.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000);

      if (profileMarkdown.length < 50) {
        console.log('LinkedIn Reader: Content too short, page may not be loaded yet');
        return null;
      }

      console.log('LinkedIn Reader: Extracted', profileMarkdown.length, 'chars for:', name);

      return {
        name,
        profileMarkdown,
        profileUrl: window.location.href,
        extractedAt: Date.now()
      };

    } catch (error) {
      console.error('LinkedIn profile extraction error:', error);
      return null;
    }
  }

  function extractAndNotifyProfile() {
    if (extractionTimeout) {
      clearTimeout(extractionTimeout);
    }

    extractionTimeout = setTimeout(() => {
      const profile = extractLinkedInProfile();

      if (profile && (!lastExtractedProfile || hasProfileChanged(profile, lastExtractedProfile))) {
        lastExtractedProfile = profile;

        chrome.runtime.sendMessage({
          action: 'profileUpdated',
          profile
        }).catch(error => {
          console.debug('Could not send profile to popup:', error);
        });
      }
    }, 500);
  }

  function hasProfileChanged(newProfile, oldProfile) {
    if (!oldProfile) return true;
    return newProfile.name !== oldProfile.name ||
           newProfile.profileUrl !== oldProfile.profileUrl ||
           newProfile.profileMarkdown.length !== oldProfile.profileMarkdown.length;
  }

  function observeProfileChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldReextract = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches?.('main, section') || node.querySelector?.('main, section')) {
                shouldReextract = true;
                break;
              }
            }
          }
        }
        if (shouldReextract) break;
      }

      if (shouldReextract) {
        extractAndNotifyProfile();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('beforeunload', () => { observer.disconnect(); });
  }

  function handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'getProfile': {
          const profile = extractLinkedInProfile();
          sendResponse({ success: true, profile });
          break;
        }
        case 'reextractProfile':
          extractAndNotifyProfile();
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // SPA navigation watcher
  let lastUrl = window.location.href;

  const checkForNavigation = () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;

      if (isLinkedInProfilePage()) {
        setTimeout(extractAndNotifyProfile, 1500);
      } else {
        lastExtractedProfile = null;
        chrome.runtime.sendMessage({ action: 'profileUpdated', profile: null }).catch(() => {});
      }
    }
  };

  setInterval(checkForNavigation, 1000);

  console.log('Aletheia LinkedIn Profile Reader (Turndown) initialized');

})();
