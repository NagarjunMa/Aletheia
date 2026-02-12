/**
 * Category-Specific Gold Standard Templates
 * Purpose: Premium baseline experience for new users with no history
 *
 * These templates provide high-quality, category-appropriate prompts when
 * users have no previous drafts for personalization.
 */

export interface CategoryBaseline {
  category: string
  name: string
  description: string
  grammarPrompt: string
  polishPrompt: string
  exampleInput: string
  exampleOutput: string
}

export const CATEGORY_BASELINES: Record<string, CategoryBaseline> = {
  linkedin: {
    category: 'linkedin',
    name: 'Professional LinkedIn Post',
    description: 'Optimized for professional networking and thought leadership',
    grammarPrompt: `You are a professional LinkedIn editor. Fix any grammar, spelling, and punctuation errors in the following text while preserving the professional tone and meaning. Maintain the LinkedIn post format.

Text: "{input}"

Return only the corrected text without explanations.`,
    polishPrompt: `You are a LinkedIn content strategist. Transform the following text into an engaging, professional LinkedIn post that drives meaningful engagement. Focus on:
- Clear professional value proposition
- Industry-appropriate tone and language
- Engaging hook in the first line
- Strategic use of hashtags (3-5 relevant ones)
- Call-to-action that encourages professional discussion

Original content: "{input}"

Return only the enhanced LinkedIn post without explanations.`,
    exampleInput: "just finished a project at work, learned a lot about data analysis",
    exampleOutput: "🎯 Just wrapped up a comprehensive data analysis project that completely shifted my perspective on business intelligence.\n\nKey takeaways:\n✅ Clean data is everything - spent 60% of time on preparation\n✅ Visualization tells the story numbers can't\n✅ Cross-functional collaboration drives better insights\n\nWhat's been your biggest lesson from recent projects?\n\n#DataAnalysis #BusinessIntelligence #ProjectManagement #ProfessionalGrowth #Analytics"
  },

  email: {
    category: 'email',
    name: 'Professional Email',
    description: 'Optimized for clear, professional email communication',
    grammarPrompt: `You are a professional email editor. Fix any grammar, spelling, and punctuation errors in the following email text while maintaining professional email etiquette and tone.

Text: "{input}"

Return only the corrected text without explanations.`,
    polishPrompt: `You are a professional communication expert. Transform the following text into a clear, professional email that achieves its purpose effectively. Focus on:
- Clear subject line suggestion if needed
- Professional greeting and closing
- Structured, scannable content with bullet points if appropriate
- Polite but direct tone
- Clear call-to-action or next steps

Original content: "{input}"

Return only the enhanced email without explanations.`,
    exampleInput: "need to setup a meeting with the team to discuss project timeline",
    exampleOutput: "Subject: Project Timeline Discussion - Team Meeting Request\n\nHi [Team/Name],\n\nI'd like to schedule a meeting to discuss our project timeline and ensure we're aligned on upcoming deliverables.\n\nProposed agenda:\n• Review current milestone status\n• Identify potential bottlenecks\n• Adjust timeline if necessary\n• Assign ownership for next phase\n\nCould we meet this week? Please let me know your availability for a 45-minute session.\n\nThanks,\n[Your name]"
  },

  instagram_post: {
    category: 'instagram_post',
    name: 'Engaging Instagram Post',
    description: 'Optimized for visual storytelling and social engagement',
    grammarPrompt: `You are a social media editor. Fix any grammar, spelling, and punctuation errors in the following Instagram post while maintaining the casual, engaging tone appropriate for social media.

Text: "{input}"

Return only the corrected text without explanations.`,
    polishPrompt: `You are a social media content creator. Transform the following text into an engaging Instagram post that captures attention and drives interaction. Focus on:
- Compelling hook in the first line
- Visual storytelling elements
- Authentic, conversational tone
- Strategic emoji usage
- Relevant hashtags (8-12 popular and niche mix)
- Call-to-action that encourages engagement

Original content: "{input}"

Return only the enhanced Instagram post without explanations.`,
    exampleInput: "went to this amazing coffee shop today, had the best latte ever",
    exampleOutput: "☕ Found my new obsession today! ✨\n\nStumbled upon this hidden gem of a coffee shop and I'm officially in love. The barista crafted what might be the most perfect latte I've ever tasted - smooth, rich, with the most beautiful latte art 🎨\n\nSometimes the best discoveries happen when you least expect them. What's been your favorite unexpected find lately?\n\n📍 [Coffee Shop Name]\n💭 Share your hidden gems in the comments!\n\n#coffee #latteart #hiddengems #coffeeshop #barista #coffeelovers #discovery #local #perfect #morningvibes #caffeinefix"
  },

  medium_article: {
    category: 'medium_article',
    name: 'Thoughtful Medium Article',
    description: 'Optimized for long-form thought leadership content',
    grammarPrompt: `You are a professional editor for Medium publications. Fix any grammar, spelling, and punctuation errors in the following article text while preserving the thoughtful, analytical tone appropriate for Medium.

Text: "{input}"

Return only the corrected text without explanations.`,
    polishPrompt: `You are a Medium content strategist. Transform the following text into a compelling Medium article that provides genuine value to readers. Focus on:
- Engaging headline and subheadline
- Strong opening hook
- Clear narrative structure with subheadings
- Thoughtful insights and actionable takeaways
- Personal anecdotes that support main points
- Professional but accessible tone

Original content: "{input}"

Return only the enhanced Medium article without explanations.`,
    exampleInput: "thinking about how remote work has changed collaboration in teams",
    exampleOutput: "# The Remote Revolution: How Virtual Collaboration Transformed Modern Teamwork\n\n## Three years of distributed work taught us more about human connection than decades of office culture\n\nRemote work didn't just change where we work—it fundamentally rewired how we think about collaboration itself.\n\nBefore 2020, collaboration meant conference rooms, whiteboards, and the assumption that proximity equals productivity. Today, I watch my distributed team achieve breakthrough innovations through asynchronous brainstorming, time-zone diversity that provides 24-hour problem-solving cycles, and digital tools that capture every insight.\n\n### The Paradox of Digital Intimacy\n\nCountintuitively, remote work created deeper professional relationships. When you regularly see colleagues' home environments, meet their families during video calls, and coordinate around personal schedules, artificial workplace boundaries dissolve.\n\n### What Changed (And What Didn't)\n\n**What evolved:**\n- Intentional communication replaced casual hallway conversations\n- Documentation became collaborative memory\n- Asynchronous work unlocked global talent pools\n\n**What remained constant:**\n- Trust still drives high-performing teams\n- Clear vision matters more than ever\n- Human creativity can't be automated\n\nThe future isn't about choosing between remote or in-person work—it's about designing intentional collaboration that leverages the best of both worlds."
  },

  conversational: {
    category: 'conversational',
    name: 'Natural Conversation',
    description: 'Optimized for casual, authentic communication',
    grammarPrompt: `You are a friendly editor. Fix any grammar, spelling, and punctuation errors in the following conversational text while preserving the natural, casual tone and flow.

Text: "{input}"

Return only the corrected text without explanations.`,
    polishPrompt: `You are a communication coach specializing in natural conversation. Enhance the following text to be clearer and more engaging while maintaining its conversational authenticity. Focus on:
- Natural flow and rhythm
- Clear expression of thoughts and feelings
- Appropriate level of detail
- Warm, approachable tone
- Authentic personal voice

Original content: "{input}"

Return only the enhanced conversational text without explanations.`,
    exampleInput: "hey wanted to tell you about this book i read, really good stuff about productivity",
    exampleOutput: "Hey! I just finished this incredible book on productivity that I think you'd love. It completely changed how I think about managing my time and energy.\n\nThe author breaks down why most productivity advice fails (spoiler: we're optimizing for the wrong things!) and shares this refreshingly simple framework that actually works with how our brains operate naturally.\n\nWhat really hit me was the chapter on 'productive rest' - turns out the way we recover is just as important as how we work. Have you ever noticed how your best ideas come when you're not trying?\n\nAnyway, I'd love to chat more about it if you're interested. The insights on focus and deep work alone are worth the read!"
  }
}

/**
 * Get the appropriate baseline template for a user's first experience
 */
export function getCategoryBaseline(category: string): CategoryBaseline {
  const baseline = CATEGORY_BASELINES[category]

  if (!baseline) {
    // Fallback to conversational for unknown categories
    return CATEGORY_BASELINES.conversational
  }

  return baseline
}

/**
 * Generate prompts using category baseline templates
 */
export function generateBaselinePrompts(
  category: string,
  userInput: string
): { grammarPrompt: string; polishPrompt: string } {
  const baseline = getCategoryBaseline(category)

  return {
    grammarPrompt: baseline.grammarPrompt.replace('{input}', userInput),
    polishPrompt: baseline.polishPrompt.replace('{input}', userInput)
  }
}

/**
 * Get example content for a category (useful for onboarding)
 */
export function getCategoryExample(category: string): { input: string; output: string } {
  const baseline = getCategoryBaseline(category)

  return {
    input: baseline.exampleInput,
    output: baseline.exampleOutput
  }
}

/**
 * List all available categories with their descriptions
 */
export function getAvailableCategories(): Array<{ id: string; name: string; description: string }> {
  return Object.values(CATEGORY_BASELINES).map(baseline => ({
    id: baseline.category,
    name: baseline.name,
    description: baseline.description
  }))
}

/**
 * Check if a category has a defined baseline
 */
export function hasBaseline(category: string): boolean {
  return category in CATEGORY_BASELINES
}