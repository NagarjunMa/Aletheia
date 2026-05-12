// Profile Extractor — Pure functions extracted from linkedin-reader.js for testability.

export function isLinkedInProfilePage(location) {
  return location.pathname.startsWith('/in/') &&
         location.hostname.includes('linkedin.com');
}

export function parseNameFromTitle(title) {
  if (!title) return null;
  return title.split(' - ')[0].replace(' | LinkedIn', '').trim() || null;
}

export function extractProfileMarkdown(element, maxChars = 8000) {
  if (!element) return '';
  const text = (element.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
  return text.slice(0, maxChars);
}

export function extractProfileFromDOM(doc, location) {
  const name = parseNameFromTitle(doc.title);
  if (!name) return null;

  const mainEl = doc.querySelector('main') || doc.body;
  const profileMarkdown = extractProfileMarkdown(mainEl);

  if (profileMarkdown.length < 50) return null;

  return {
    name,
    profileMarkdown,
    profileUrl: location.href,
    extractedAt: Date.now(),
  };
}

export function hasProfileChanged(newProfile, oldProfile) {
  if (!oldProfile) return true;
  return newProfile.name !== oldProfile.name ||
         newProfile.profileUrl !== oldProfile.profileUrl ||
         newProfile.profileMarkdown.length !== oldProfile.profileMarkdown.length;
}
