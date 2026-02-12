import { CPLMilestoneData, EmailTemplate } from '../types'
import { EMAIL_CONFIG } from '../client'

const MILESTONE_CONFIG = {
  bronze: { color: '#CD7F32', emoji: '🥉', title: 'Bronze Writer', description: 'Great foundation in writing quality!' },
  silver: { color: '#C0C0C0', emoji: '🥈', title: 'Silver Wordsmith', description: 'Excellent writing consistency!' },
  gold: { color: '#FFD700', emoji: '🥇', title: 'Gold Storyteller', description: 'Outstanding writing excellence!' },
  platinum: { color: '#E5E4E2', emoji: '💎', title: 'Platinum Author', description: 'Exceptional mastery of language!' },
  diamond: { color: '#B9F2FF', emoji: '💠', title: 'Diamond Virtuoso', description: 'Legendary writing prowess!' }
} as const

export function createCPLMilestoneTemplate(data: CPLMilestoneData): EmailTemplate {
  const { user, previousCPL, newCPL, milestone, achievementDate, totalDrafts } = data
  const userName = user.name || user.email.split('@')[0]
  const config = MILESTONE_CONFIG[milestone]

  const subject = `🎉 Congratulations! You've reached ${config.title} level (CPL ${newCPL})`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f9fa;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
            ${EMAIL_CONFIG.company.name}
          </h1>
          <p style="color: white; margin: 8px 0 0 0; opacity: 0.9; font-size: 16px;">
            ${EMAIL_CONFIG.company.tagline}
          </p>
        </div>

        <!-- Achievement Banner -->
        <div style="background: linear-gradient(135deg, ${config.color}20 0%, ${config.color}40 100%); padding: 40px 30px; text-align: center; border-bottom: 3px solid ${config.color};">
          <div style="font-size: 64px; margin-bottom: 20px;">${config.emoji}</div>
          <h2 style="color: #333; margin: 0 0 10px 0; font-size: 32px; font-weight: bold;">
            Congratulations, ${userName}!
          </h2>
          <p style="color: #666; font-size: 18px; margin: 0 0 20px 0;">
            You've achieved <strong style="color: ${config.color};">${config.title}</strong> status!
          </p>
          <div style="background: white; border-radius: 50px; padding: 15px 30px; display: inline-block; border: 2px solid ${config.color};">
            <span style="color: #333; font-size: 24px; font-weight: bold;">CPL ${newCPL}</span>
          </div>
        </div>

        <!-- Main Content -->
        <div style="padding: 40px 30px;">

          <!-- Achievement Details -->
          <div style="background: #f8f9fa; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
            <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">🏆 Achievement Details</h3>

            <div style="display: grid; gap: 15px;">

              <!-- CPL Progress -->
              <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid ${config.color};">
                <div style="margin-bottom: 10px;">
                  <span style="color: #666; font-size: 14px; font-weight: 500;">Content Polish Level Progress</span>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                  <span style="color: #999; font-size: 18px;">CPL ${previousCPL}</span>
                  <div style="flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; position: relative;">
                    <div style="height: 100%; background: linear-gradient(90deg, ${config.color}, ${config.color}80); border-radius: 4px; width: ${(newCPL / 10) * 100}%;"></div>
                  </div>
                  <span style="color: ${config.color}; font-size: 18px; font-weight: bold;">CPL ${newCPL}</span>
                </div>
              </div>

              <!-- Total Drafts -->
              <div style="background: white; border-radius: 8px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #666; font-size: 14px; font-weight: 500;">Total Drafts Generated</span>
                  <span style="color: #333; font-size: 24px; font-weight: bold;">${totalDrafts.toLocaleString()}</span>
                </div>
              </div>

              <!-- Achievement Date -->
              <div style="background: white; border-radius: 8px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #666; font-size: 14px; font-weight: 500;">Achievement Date</span>
                  <span style="color: #333; font-size: 16px; font-weight: 600;">${new Date(achievementDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>

            </div>
          </div>

          <!-- Milestone Description -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h3 style="color: #333; margin: 0 0 15px 0; font-size: 20px;">${config.title} Achievement</h3>
            <p style="color: #666; font-size: 18px; line-height: 1.6; margin: 0;">
              ${config.description}
            </p>
          </div>

          <!-- What's Next -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center; color: white;">
            <h3 style="color: white; margin: 0 0 15px 0; font-size: 20px;">🚀 What's Next?</h3>
            <p style="color: rgba(255,255,255,0.9); margin: 0 0 20px 0; line-height: 1.6;">
              Keep writing and refining your content to reach the next milestone. Your consistent improvement is inspiring!
            </p>
            <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 15px; backdrop-filter: blur(10px);">
              <p style="color: white; margin: 0; font-weight: 600;">
                ${newCPL < 10 ? `Next milestone: CPL ${Math.min(10, newCPL + 1)}` : 'You\'ve reached the highest level! 🎉'}
              </p>
            </div>
          </div>

          <!-- CTA -->
          <div style="text-align: center; margin: 40px 0;">
            <a href="${EMAIL_CONFIG.company.website}/dashboard"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 8px;
                      font-weight: bold;
                      display: inline-block;
                      font-size: 16px;">
              Continue Your Journey
            </a>
          </div>

          <!-- Footer Message -->
          <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
            Thank you for being part of the Ascendia community. Your dedication to improving your writing is truly commendable!
          </p>

        </div>

        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">
            © 2024 ${EMAIL_CONFIG.company.name}. All rights reserved.
          </p>
          <p style="color: #999; margin: 0; font-size: 12px;">
            <a href="${EMAIL_CONFIG.company.website}/unsubscribe?token={{unsubscribe_token}}" style="color: #999; text-decoration: underline;">Unsubscribe</a> |
            <a href="${EMAIL_CONFIG.company.website}/email-preferences?token={{preferences_token}}" style="color: #999; text-decoration: underline;">Email Preferences</a> |
            <a href="mailto:${EMAIL_CONFIG.company.supportEmail}" style="color: #999; text-decoration: underline;">Support</a>
          </p>
        </div>

      </div>
    </body>
    </html>
  `

  const text = `
    🎉 Congratulations, ${userName}!

    You've achieved ${config.title} status!

    🏆 Achievement Details:
    • Previous CPL: ${previousCPL}
    • New CPL: ${newCPL}
    • Total Drafts: ${totalDrafts.toLocaleString()}
    • Achievement Date: ${new Date(achievementDate).toLocaleDateString()}

    ${config.title}: ${config.description}

    🚀 What's Next?
    Keep writing and refining your content to reach the next milestone. Your consistent improvement is inspiring!

    ${newCPL < 10 ? `Next milestone: CPL ${Math.min(10, newCPL + 1)}` : 'You\'ve reached the highest level! 🎉'}

    Continue your journey: ${EMAIL_CONFIG.company.website}/dashboard

    ---
    © 2024 ${EMAIL_CONFIG.company.name}
    Unsubscribe: ${EMAIL_CONFIG.company.website}/unsubscribe
    Support: ${EMAIL_CONFIG.company.supportEmail}
  `

  return {
    subject,
    html,
    text
  }
}