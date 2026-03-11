// LinkedIn Profile Reader Content Script
// Extracts profile information from LinkedIn profile pages

(function() {
  'use strict';

  // Profile extraction state
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

    // Check if we're on a LinkedIn profile page
    if (!isLinkedInProfilePage()) {
      console.log('LinkedIn Reader: Not a LinkedIn profile page, exiting');
      return;
    }

    console.log('LinkedIn Reader: On LinkedIn profile page, setting up profile extraction');

    // Wait a bit for content to load, then extract
    setTimeout(() => {
      extractAndNotifyProfile();
    }, 1000);

    // Also try immediate extraction
    extractAndNotifyProfile();

    // Watch for dynamic content changes (LinkedIn is SPA)
    observeProfileChanges();

    // Listen for requests from popup
    chrome.runtime.onMessage.addListener(handleMessage);

    console.log('LinkedIn Reader: Setup complete');
  }

  function isLinkedInProfilePage() {
    return window.location.pathname.startsWith('/in/') &&
           window.location.hostname.includes('linkedin.com');
  }

  function extractLinkedInProfile() {
    try {
      console.log('LinkedIn Reader: Starting profile extraction...');

      // Basic profile information
      const name = extractName();
      const headline = extractHeadline();
      const location = extractLocation();
      const about = extractAbout();
      const experiences = extractExperiences();
      const recentPosts = extractRecentPosts();
      const skills = extractSkills();
      const profileUrl = window.location.href;

      console.log('LinkedIn Reader: Extracted data:', {
        name: name ? `"${name}"` : 'NULL',
        headline: headline ? `"${headline.substring(0, 50)}..."` : 'NULL',
        location: location ? `"${location}"` : 'NULL',
        about: about ? `"${about.substring(0, 50)}..."` : 'NULL',
        experiences: experiences.length,
        recentPosts: recentPosts.length,
        skills: skills.length,
        profileUrl
      });

      const profile = {
        name,
        headline,
        location,
        about,
        experiences,
        recentPosts,
        skills,
        profileUrl,
        extractedAt: Date.now()
      };

      // Validate profile has minimum required data
      if (!profile.name) {
        console.log('LinkedIn Reader: Profile extraction failed - no name found');
        return null;
      }

      console.log('LinkedIn Reader: Profile extraction successful!');
      return profile;

    } catch (error) {
      console.error('LinkedIn profile extraction error:', error);
      return null;
    }
  }

  function extractName() {
    // Multiple selectors for name (LinkedIn changes frequently)
    const nameSelectors = [
      'h1.text-heading-xlarge', // Current design
      'h1[data-anonymize="person-name"]', // Data attribute
      '.pv-text-details__name h1', // Classic design
      '.pv-top-card .pv-text-details__name h1', // Older design
      'main section .text-heading-xlarge', // Main section
      '.pv-text-details__name', // Without h1
      '.top-card-layout__name', // Top card variant
      '[data-field="name"]', // Data field
      '.text-heading-xlarge', // Generic heading
      '.profile-info h1', // Profile info section
      'h1:first-of-type', // First h1 on page
      '.pv-top-card-profile-picture + div h1' // Next to profile picture
    ];

    for (const selector of nameSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        const name = element.textContent.trim();
        // Validate it looks like a name (not too long, contains letters)
        if (name.length > 1 && name.length < 100 && /[a-zA-Z]/.test(name)) {
          console.log('LinkedIn Reader: Found name with selector:', selector, 'Name:', name);
          return name;
        }
      }
    }

    console.log('LinkedIn Reader: No name found with any selector');
    return null;
  }

  function extractHeadline() {
    const headlineSelectors = [
      '.text-body-medium.break-words', // Current design
      '.pv-text-details__headline', // Classic design
      '.top-card-layout__headline', // Top card variant
      'main section .text-body-medium', // Main section
      '.text-body-medium', // Generic medium text
      '.pv-top-card__headline', // Top card headline
      '[data-field="headline"]', // Data field
      '.profile-info .text-body-medium', // Profile info
      '.pv-text-details__headline .text-body-medium', // Nested
      '.artdeco-entity-lockup__subtitle', // Entity lockup
      '.top-card-layout__first-subline', // First subline
      'h2.text-heading-medium + div' // After h2 heading
    ];

    for (const selector of headlineSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        const text = element.textContent.trim();
        // Filter out generic text that might not be headline
        if (text.length > 5 && text.length < 500 && !text.includes('500+') && !text.includes('connections')) {
          console.log('LinkedIn Reader: Found headline with selector:', selector, 'Headline:', text.substring(0, 50) + '...');
          return text;
        }
      }
    }

    console.log('LinkedIn Reader: No headline found with any selector');
    return null;
  }

  function extractLocation() {
    const locationSelectors = [
      '.text-body-small.inline.t-black--light.break-words',
      '.pv-text-details__location',
      '.top-card-layout__location',
      '[data-anonymize="location"]'
    ];

    for (const selector of locationSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  function extractAbout() {
    const aboutSelectors = [
      '#about ~ .display-flex .inline-show-more-text',
      '.pv-about__summary-text .inline-show-more-text',
      '#about + section .inline-show-more-text',
      '[data-field="summary"] .inline-show-more-text'
    ];

    for (const selector of aboutSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim().slice(0, 1000); // Limit length
      }
    }

    return null;
  }

  function extractExperiences() {
    const experiences = [];

    try {
      // Look for experience section
      const experienceSection = document.querySelector('#experience')?.closest('section');

      if (experienceSection) {
        const experienceItems = experienceSection.querySelectorAll('li.artdeco-list__item, .pvs-entity');

        experienceItems.forEach((item, index) => {
          if (index >= 5) return; // Limit to 5 most recent experiences

          const titleElement = item.querySelector('.t-bold span, .mr1.t-bold span, [data-field="title"]');
          const companyElement = item.querySelector('.t-normal span, [data-field="company"]');

          const title = titleElement?.textContent?.trim();
          const company = companyElement?.textContent?.trim();

          if (title) {
            experiences.push({
              title,
              company: company || null
            });
          }
        });
      }
    } catch (error) {
      console.warn('Error extracting experiences:', error);
    }

    return experiences;
  }

  function extractRecentPosts() {
    const posts = [];

    try {
      // Look for recent activity/posts
      const postElements = document.querySelectorAll('.feed-shared-update-v2, .profile-recent-activity');

      postElements.forEach((post, index) => {
        if (index >= 3) return; // Limit to 3 recent posts

        const textElement = post.querySelector('.break-words, .feed-shared-text');
        if (textElement?.textContent?.trim()) {
          const postText = textElement.textContent.trim().slice(0, 300); // Limit length
          if (postText.length > 20) { // Filter out very short posts
            posts.push(postText);
          }
        }
      });
    } catch (error) {
      console.warn('Error extracting posts:', error);
    }

    return posts;
  }

  function extractSkills() {
    const skills = [];

    try {
      // Look for skills section
      const skillsSection = document.querySelector('#skills')?.closest('section');

      if (skillsSection) {
        const skillElements = skillsSection.querySelectorAll('.t-bold span, [data-field="skill_name"]');

        skillElements.forEach((skill, index) => {
          if (index >= 10) return; // Limit to 10 skills

          const skillText = skill.textContent?.trim();
          if (skillText && skillText.length > 1) {
            skills.push(skillText);
          }
        });
      }
    } catch (error) {
      console.warn('Error extracting skills:', error);
    }

    return skills;
  }

  function extractAndNotifyProfile() {
    // Clear any pending extraction
    if (extractionTimeout) {
      clearTimeout(extractionTimeout);
    }

    // Debounce profile extraction
    extractionTimeout = setTimeout(() => {
      const profile = extractLinkedInProfile();

      if (profile && (!lastExtractedProfile || hasProfileChanged(profile, lastExtractedProfile))) {
        lastExtractedProfile = profile;

        // Notify popup about profile update
        chrome.runtime.sendMessage({
          action: 'profileUpdated',
          profile: profile
        }).catch(error => {
          // Popup might not be open, which is fine
          console.debug('Could not send profile to popup:', error);
        });
      }
    }, 500);
  }

  function hasProfileChanged(newProfile, oldProfile) {
    if (!oldProfile) return true;

    // Check key fields for changes
    return (
      newProfile.name !== oldProfile.name ||
      newProfile.headline !== oldProfile.headline ||
      newProfile.location !== oldProfile.location ||
      newProfile.about !== oldProfile.about
    );
  }

  function observeProfileChanges() {
    // Create observer to watch for dynamic content changes
    const observer = new MutationObserver((mutations) => {
      let shouldReextract = false;

      for (const mutation of mutations) {
        // Check if important sections were added/modified
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);

          for (const node of addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if this could be profile content
              if (node.matches?.('main, section, .pv-profile-section') ||
                  node.querySelector?.('main, section, .pv-profile-section')) {
                shouldReextract = true;
                break;
              }
            }
          }
        }
      }

      if (shouldReextract) {
        extractAndNotifyProfile();
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Clean up on navigation
    window.addEventListener('beforeunload', () => {
      observer.disconnect();
    });
  }

  function handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'getProfile':
          const profile = extractLinkedInProfile();
          sendResponse({
            success: true,
            profile: profile
          });
          break;

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

    return true; // Keep message channel open for async response
  }

  // Handle page navigation in SPA
  let lastUrl = window.location.href;

  const checkForNavigation = () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;

      if (isLinkedInProfilePage()) {
        // New profile page loaded
        setTimeout(extractAndNotifyProfile, 1000); // Give time for content to load
      } else {
        // Navigated away from profile
        lastExtractedProfile = null;
        chrome.runtime.sendMessage({
          action: 'profileUpdated',
          profile: null
        }).catch(() => {
          // Ignore if popup is closed
        });
      }
    }
  };

  // Watch for navigation changes
  setInterval(checkForNavigation, 1000);

  console.log('Aletheia LinkedIn Profile Reader initialized');

})();