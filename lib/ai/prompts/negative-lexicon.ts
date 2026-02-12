// Negative Lexicon for Content Sanitization
// Purpose: Remove AI-generated phrases that make content sound robotic

export const NEGATIVE_LEXICON = [
  // AI assistant phrases
  "I'd be happy to",
  "I'd be glad to",
  "I'd love to help",
  "feel free to",
  "don't hesitate to",
  "please don't hesitate",
  "I hope this helps",
  "I hope this is helpful",
  "I hope you find this helpful",

  // Overly formal transitions
  "furthermore",
  "moreover",
  "in addition to that",
  "it's worth noting that",
  "it's important to note",
  "it should be noted that",
  "as previously mentioned",
  "as I mentioned earlier",

  // Generic business speak
  "leverage synergies",
  "circle back",
  "reach out",
  "touch base",
  "move the needle",
  "game-changer",
  "paradigm shift",
  "disruptive innovation",
  "thought leadership",
  "best practices",
  "low-hanging fruit",
  "take it offline",
  "drill down",
  "bandwidth",
  "bandwidth to",

  // AI hedge words
  "potentially",
  "perhaps we could",
  "it might be beneficial",
  "you might consider",
  "you may want to",
  "it could be worth",
  "might be interesting",
  "could potentially",

  // Robotic closings
  "thank you for your time and consideration",
  "I look forward to hearing from you",
  "I appreciate your consideration",
  "thank you for your attention",
  "I await your response",
  "looking forward to your reply",

  // AI qualifiers
  "as an AI",
  "as a language model",
  "I'm not able to",
  "I cannot",
  "I don't have access to",
  "based on the information provided",
  "according to my training",

  // Generic networking phrases
  "expand my network",
  "grow my network",
  "connect with like-minded professionals",
  "fellow professionals",
  "industry leader",
  "thought leader",
  "expert in the field",
  "passionate about",
  "excited to connect",

  // Overused adjectives
  "amazing opportunity",
  "incredible",
  "fantastic",
  "awesome",
  "outstanding",
  "remarkable",
  "exceptional",
  "extraordinary",
  "revolutionary",
  "cutting-edge",
  "state-of-the-art",
  "world-class",

  // Sales-y language
  "unique opportunity",
  "limited time",
  "act now",
  "don't miss out",
  "exclusive",
  "special offer",
  "once in a lifetime",
  "this opportunity won't last",
  "time-sensitive",

  // Empty phrases
  "to be honest",
  "quite frankly",
  "I must say",
  "it goes without saying",
  "needless to say",
  "obviously",
  "clearly",
  "undoubtedly",
  "without a doubt",
  "absolutely",
  "definitely",
  "certainly",

  // Academic language
  "methodology",
  "utilize",
  "facilitate",
  "optimal",
  "implement",
  "comprehensive",
  "extensive",
  "substantial",
  "significant",
  "considerable",
  "numerous",
  "various",
  "multiple",

  // Corporate jargon
  "deliverables",
  "stakeholders",
  "actionable insights",
  "value proposition",
  "core competencies",
  "strategic initiatives",
  "cross-functional",
  "scalable solutions",
  "robust framework",
  "holistic approach",
  "end-to-end",
  "seamless integration"
];

// Function to sanitize content by removing negative lexicon phrases
export function sanitizeContent(text: string): string {
  let result = text;

  for (const phrase of NEGATIVE_LEXICON) {
    // Create case-insensitive regex with word boundaries
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    result = result.replace(regex, '');
  }

  // Clean up extra whitespace created by removals
  result = result.replace(/\s{2,}/g, ' ').trim();

  // Clean up punctuation issues
  result = result.replace(/\s+([,.!?])/g, '$1');
  result = result.replace(/([.!?])\s*([.!?])/g, '$1');

  return result;
}