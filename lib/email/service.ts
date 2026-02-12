import { resend, EMAIL_CONFIG } from './client'
import { createUsageSummaryTemplate } from './templates/usage-summary'
import { createCPLMilestoneTemplate } from './templates/cpl-milestone'
import { createFeatureAnnouncementTemplate } from './templates/feature-announcement'
import {
  EmailUser,
  UsageSummaryData,
  CPLMilestoneData,
  FeatureAnnouncementData,
  SystemNotificationData
} from './types'

export class EmailService {
  private static instance: EmailService

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_CONFIG.from,
        to,
        subject,
        html,
        text,
        replyTo: EMAIL_CONFIG.replyTo
      })

      if (error) {
        console.error('Resend API error:', error)
        return { success: false, error: error.message || 'Email sending failed' }
      }

      console.log('Email sent successfully:', data?.id)
      return { success: true, messageId: data?.id }

    } catch (error) {
      console.error('Email service error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown email error'
      }
    }
  }

  /**
   * Send weekly/monthly usage summary email
   */
  async sendUsageSummary(data: UsageSummaryData): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      const template = createUsageSummaryTemplate(data)

      return await this.sendEmail(
        data.user.email,
        template.subject,
        template.html,
        template.text
      )
    } catch (error) {
      console.error('Error sending usage summary:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send usage summary'
      }
    }
  }

  /**
   * Send CPL milestone achievement email
   */
  async sendCPLMilestone(data: CPLMilestoneData): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      const template = createCPLMilestoneTemplate(data)

      return await this.sendEmail(
        data.user.email,
        template.subject,
        template.html,
        template.text
      )
    } catch (error) {
      console.error('Error sending CPL milestone:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send CPL milestone email'
      }
    }
  }

  /**
   * Send feature announcement email
   */
  async sendFeatureAnnouncement(data: FeatureAnnouncementData): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      const template = createFeatureAnnouncementTemplate(data)

      return await this.sendEmail(
        data.user.email,
        template.subject,
        template.html,
        template.text
      )
    } catch (error) {
      console.error('Error sending feature announcement:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send feature announcement'
      }
    }
  }

  /**
   * Send system notification email
   */
  async sendSystemNotification(data: SystemNotificationData): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      const { user, type, title, message, action, severity } = data

      const severityColors = {
        info: '#3b82f6',
        warning: '#f59e0b',
        error: '#ef4444'
      }

      const severityEmojis = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '🚨'
      }

      const subject = `${severityEmojis[severity]} ${title}`

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
                System Notification
              </p>
            </div>

            <!-- Main Content -->
            <div style="padding: 40px 30px;">

              <!-- Notification Header -->
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px;">${severityEmojis[severity]}</div>
                <h2 style="color: #333; margin: 0 0 15px 0; font-size: 24px; font-weight: bold;">
                  ${title}
                </h2>
              </div>

              <!-- Message -->
              <div style="background: ${severityColors[severity]}10; border-left: 4px solid ${severityColors[severity]}; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0;">
                  ${message}
                </p>
              </div>

              <!-- Action Button -->
              ${action ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${action.url}"
                     style="background: ${severityColors[severity]};
                            color: white;
                            padding: 15px 30px;
                            text-decoration: none;
                            border-radius: 8px;
                            font-weight: bold;
                            display: inline-block;
                            font-size: 16px;">
                    ${action.text}
                  </a>
                </div>
              ` : ''}

              <!-- Support Message -->
              <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                If you have any questions, please contact our support team at
                <a href="mailto:${EMAIL_CONFIG.company.supportEmail}" style="color: #667eea;">${EMAIL_CONFIG.company.supportEmail}</a>
              </p>

            </div>

            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #666; margin: 0; font-size: 14px;">
                © 2024 ${EMAIL_CONFIG.company.name}. All rights reserved.
              </p>
            </div>

          </div>
        </body>
        </html>
      `

      const text = `
        ${severityEmojis[severity]} ${title}

        ${message}

        ${action ? `${action.text}: ${action.url}` : ''}

        If you have any questions, please contact our support team at ${EMAIL_CONFIG.company.supportEmail}

        ---
        © 2024 ${EMAIL_CONFIG.company.name}
      `

      return await this.sendEmail(user.email, subject, html, text)

    } catch (error) {
      console.error('Error sending system notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send system notification'
      }
    }
  }

  /**
   * Send bulk emails to multiple users (with rate limiting)
   */
  async sendBulkEmails(
    emails: Array<{
      user: EmailUser
      subject: string
      html: string
      text?: string
    }>,
    options: {
      delayMs?: number // Delay between emails to respect rate limits
      maxConcurrent?: number // Maximum concurrent emails
    } = {}
  ): Promise<Array<{ user: EmailUser; success: boolean; error?: string; messageId?: string }>> {
    const { delayMs = 1000, maxConcurrent = 5 } = options
    const results: Array<{ user: EmailUser; success: boolean; error?: string; messageId?: string }> = []

    // Process emails in batches to respect rate limits
    for (let i = 0; i < emails.length; i += maxConcurrent) {
      const batch = emails.slice(i, i + maxConcurrent)

      const batchPromises = batch.map(async ({ user, subject, html, text }) => {
        const result = await this.sendEmail(user.email, subject, html, text)
        return { user, ...result }
      })

      const batchResults = await Promise.allSettled(batchPromises)

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          console.error('Bulk email batch error:', result.reason)
          // You might want to add the failed user to results with an error
        }
      })

      // Add delay between batches if there are more emails to process
      if (i + maxConcurrent < emails.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }

    return results
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance()