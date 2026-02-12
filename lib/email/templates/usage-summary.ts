import { UsageSummaryData, EmailTemplate } from '../types'
import { EMAIL_CONFIG } from '../client'

export function createUsageSummaryTemplate(data: UsageSummaryData): EmailTemplate {
  const { user, period, stats, dateRange } = data
  const periodText = period === 'weekly' ? 'Week' : 'Month'
  const userName = user.name || user.email.split('@')[0]

  const subject = `Your ${periodText}ly Writing Summary - ${stats.improvementPercentage}% Improvement!`

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

        <!-- Main Content -->
        <div style="padding: 40px 30px;">

          <!-- Greeting -->
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">
            Hi ${userName}! 👋
          </h2>

          <p style="color: #666; line-height: 1.6; font-size: 16px; margin: 0 0 30px 0;">
            Here's your ${period}ly writing summary for ${dateRange.start} - ${dateRange.end}.
            You're making great progress!
          </p>

          <!-- Stats Cards -->
          <div style="background: #f8f9fa; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
            <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">📊 Your Writing Stats</h3>

            <div style="display: grid; gap: 20px;">

              <!-- Improvement Percentage -->
              <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #667eea;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #666; font-size: 14px; font-weight: 500;">Writing Improvement</span>
                  <span style="color: #667eea; font-size: 24px; font-weight: bold;">+${stats.improvementPercentage}%</span>
                </div>
              </div>

              <!-- Total Inputs -->
              <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #764ba2;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #666; font-size: 14px; font-weight: 500;">Content Processed</span>
                  <span style="color: #764ba2; font-size: 24px; font-weight: bold;">${stats.totalInputs}</span>
                </div>
              </div>

              <!-- Drafts Generated -->
              <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #10b981;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #666; font-size: 14px; font-weight: 500;">Drafts Generated</span>
                  <span style="color: #10b981; font-size: 24px; font-weight: bold;">${stats.totalDrafts}</span>
                </div>
              </div>

              <!-- Average CPL -->
              <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #f59e0b;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #666; font-size: 14px; font-weight: 500;">Average CPL Score</span>
                  <span style="color: #f59e0b; font-size: 24px; font-weight: bold;">${stats.averageCPL}/10</span>
                </div>
              </div>

            </div>
          </div>

          <!-- Writing Streak -->
          ${stats.streakDays > 0 ? `
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center;">
            <h3 style="color: white; margin: 0 0 10px 0; font-size: 20px;">🔥 Writing Streak</h3>
            <p style="color: white; margin: 0; font-size: 32px; font-weight: bold;">${stats.streakDays} Days</p>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Keep up the momentum!</p>
          </div>
          ` : ''}

          <!-- Top Categories -->
          ${stats.topCategories.length > 0 ? `
          <div style="background: #f8f9fa; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
            <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">📝 Top Writing Categories</h3>
            ${stats.topCategories.map((category, index) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; ${index < stats.topCategories.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : ''}">
                <span style="color: #666; font-size: 16px;">${category.category}</span>
                <span style="color: #333; font-weight: 600;">${category.count}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}

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
              View Full Dashboard
            </a>
          </div>

          <!-- Footer Message -->
          <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
            Keep up the great work! Your writing is improving consistently, and we're excited to see your continued progress.
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
    Hi ${userName}!

    Here's your ${period}ly writing summary for ${dateRange.start} - ${dateRange.end}:

    📊 Your Writing Stats:
    • Writing Improvement: +${stats.improvementPercentage}%
    • Content Processed: ${stats.totalInputs}
    • Drafts Generated: ${stats.totalDrafts}
    • Average CPL Score: ${stats.averageCPL}/10
    ${stats.streakDays > 0 ? `• Writing Streak: ${stats.streakDays} days` : ''}

    ${stats.topCategories.length > 0 ? `
    📝 Top Writing Categories:
    ${stats.topCategories.map(cat => `• ${cat.category}: ${cat.count}`).join('\n')}
    ` : ''}

    Keep up the great work! Visit your dashboard: ${EMAIL_CONFIG.company.website}/dashboard

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