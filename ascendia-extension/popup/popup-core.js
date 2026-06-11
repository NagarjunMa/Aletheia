// Popup Core — Pure functions extracted from popup.js for testability.
// No DOM access, no chrome.* calls — just data transformations.

/**
 * Parse a generation response, extracting JSON for cold_email/inmail.
 */
export function parseGenerationResponse(output) {
  const processed = { ...output };

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
          processed.subject_line = parsed.subject_line || output.subject_line;
          processed.body = parsed.body || output.body;
        }
      }
    } catch {
      // JSON parse failed — keep original body
    }
  }

  return processed;
}

/**
 * Calculate character count info for a given category.
 * Returns { count, displayText, isOverLimit, isNearLimit }.
 */
export function calculateCharCount(text, category) {
  const count = text.length;
  let isOverLimit = false;
  let isNearLimit = false;
  let displayText;

  switch (category) {
    case 'linkedin_connection':
      isOverLimit = count > 300;
      isNearLimit = !isOverLimit && count > 270;
      displayText = `${count}/300`;
      break;
    case 'linkedin_inmail':
      isOverLimit = count > 1800;
      displayText = `${count} chars`;
      break;
    case 'cold_email':
      isOverLimit = count > 1500;
      displayText = `${count} chars`;
      break;
    default:
      displayText = `${count} chars`;
  }

  return { count, displayText, isOverLimit, isNearLimit };
}

/**
 * Build generate request payload.
 */
export function buildGeneratePayload(
  profile,
  resume,
  contextValue,
  category,
  intent,
  acceptedExamples,
  emailMode = 'initial_outreach',
) {
  const isFollowUp = emailMode === 'follow_up';
  return {
    profileMarkdown: profile.profileMarkdown,
    profileUrl: profile.profileUrl,
    resume: resume || '',
    jd: isFollowUp ? '' : contextValue || '',
    conversationContext: isFollowUp ? contextValue || '' : '',
    category,
    intent,
    emailMode,
    acceptedExamples: acceptedExamples || [],
  };
}

/**
 * Check if an error message indicates an auth issue.
 */
export function isAuthError(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes('not authenticated') ||
    lower.includes('unauthorized') ||
    lower.includes('auth_failed') ||
    lower.includes('session expired') ||
    lower.includes('please log in');
}
