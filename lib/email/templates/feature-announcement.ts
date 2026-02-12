import { FeatureAnnouncementData, EmailTemplate } from '../types'
import { EMAIL_CONFIG } from '../client'

export function createFeatureAnnouncementTemplate(data: FeatureAnnouncementData): EmailTemplate {
  const { user, title, description, features, ctaText, ctaUrl, imageUrl } = data
  const userName = user.name || user.email.split('@')[0]

  const subject = `🚀 New Feature: ${title}`

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

        <!-- Feature Image (if provided) -->
        ${imageUrl ? `
        <div style="text-align: center; padding: 0;">
          <img src="${imageUrl}"
               alt="${title}"
               style="width: 100%; max-width: 600px; height: auto; display: block;" />
        </div>
        ` : ''}

        <!-- Main Content -->
        <div style="padding: 40px 30px;">

          <!-- Greeting and Announcement -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 48px; margin-bottom: 20px;">🚀</div>
            <h2 style="color: #333; margin: 0 0 15px 0; font-size: 28px; font-weight: bold;">
              ${title}
            </h2>
            <p style="color: #666; font-size: 18px; line-height: 1.6; margin: 0;">
              Hi ${userName}! We're excited to share something new with you.
            </p>
          </div>

          <!-- Description -->
          <div style="margin-bottom: 30px;">
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0;">
              ${description}
            </p>
          </div>

          <!-- Features List -->
          <div style="background: #f8f9fa; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
            <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">✨ What's New</h3>

            ${features.map((feature, index) => `
              <div style="display: flex; gap: 15px; align-items: flex-start; padding: 15px 0; ${index < features.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : ''}">
                ${feature.icon ? `
                  <div style="flex-shrink: 0; width: 32px; height: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                    ${feature.icon}
                  </div>
                ` : `
                  <div style="flex-shrink: 0; width: 8px; height: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin-top: 8px;"></div>
                `}
                <div>
                  <h4 style="color: #333; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
                    ${feature.name}
                  </h4>
                  <p style="color: #666; margin: 0; font-size: 14px; line-height: 1.5;">
                    ${feature.description}
                  </p>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- CTA -->
          <div style="text-align: center; margin: 40px 0;">
            <a href="${ctaUrl}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 8px;
                      font-weight: bold;
                      display: inline-block;
                      font-size: 16px;">
              ${ctaText}
            </a>
          </div>

          <!-- Additional Info -->
          <div style="background: linear-gradient(135deg, #667eea10 0%, #764ba220 100%); border-radius: 12px; padding: 20px; margin-bottom: 30px; border-left: 4px solid #667eea;">
            <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
              💡 <strong>Tip:</strong> Have feedback about this new feature? We'd love to hear from you!
              Reply to this email or reach out to our support team.
            </p>
          </div>

          <!-- Footer Message -->
          <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
            Thank you for being part of our journey as we continue to improve your writing experience!
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
    🚀 ${title}

    Hi ${userName}!

    ${description}

    ✨ What's New:
    ${features.map(feature => `• ${feature.name}: ${feature.description}`).join('\n')}

    ${ctaText}: ${ctaUrl}

    💡 Tip: Have feedback about this new feature? We'd love to hear from you! Reply to this email or reach out to our support team.

    Thank you for being part of our journey as we continue to improve your writing experience!

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