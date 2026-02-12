'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { emailService, type UsageSummaryData, type CPLMilestoneData, type FeatureAnnouncementData, type SystemNotificationData, createFeatureAnnouncementTemplate } from '@/lib/email'
import { revalidatePath } from 'next/cache'

// Validation schemas
const sendUsageSummarySchema = z.object({
  userId: z.string().uuid(),
  period: z.enum(['weekly', 'monthly'])
})

const sendCPLMilestoneSchema = z.object({
  userId: z.string().uuid(),
  previousCPL: z.number().min(0).max(10),
  newCPL: z.number().min(0).max(10),
  milestone: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond'])
})

const sendFeatureAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  features: z.array(z.object({
    name: z.string().min(1).max(100),
    description: z.string().min(1).max(300),
    icon: z.string().optional()
  })),
  ctaText: z.string().min(1).max(50),
  ctaUrl: z.string().url(),
  imageUrl: z.string().url().optional(),
  targetUsers: z.enum(['all', 'active', 'premium']).default('all')
})

const sendSystemNotificationSchema = z.object({
  type: z.enum(['maintenance', 'security', 'feature', 'billing']),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  action: z.object({
    text: z.string().min(1).max(50),
    url: z.string().url()
  }).optional(),
  severity: z.enum(['info', 'warning', 'error']).default('info'),
  targetUsers: z.enum(['all', 'active', 'premium']).default('all')
})

/**
 * Send usage summary email to a specific user
 */
export async function sendUsageSummaryEmail(data: z.infer<typeof sendUsageSummarySchema>) {
  try {
    const { userId, period } = sendUsageSummarySchema.parse(data)
    const supabase = createClient()

    // Get user data
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return { success: false, error: 'User not found' }
    }

    // Calculate date range
    const now = new Date()
    const startDate = new Date()

    if (period === 'weekly') {
      startDate.setDate(now.getDate() - 7)
    } else {
      startDate.setMonth(now.getMonth() - 1)
    }

    // Get user statistics
    const [inputsResult, draftsResult, cplResult] = await Promise.all([
      // Get total inputs
      supabase
        .from('user_inputs')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString()),

      // Get total drafts and average CPL
      supabase
        .from('generated_drafts')
        .select('id, cpl_score')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString()),

      // Get previous period data for improvement calculation
      supabase
        .from('generated_drafts')
        .select('cpl_score')
        .eq('user_id', userId)
        .gte('created_at', new Date(startDate.getTime() - (now.getTime() - startDate.getTime())).toISOString())
        .lt('created_at', startDate.toISOString())
    ])

    if (inputsResult.error || draftsResult.error || cplResult.error) {
      return { success: false, error: 'Failed to fetch user statistics' }
    }

    const totalInputs = inputsResult.data?.length || 0
    const drafts = draftsResult.data || []
    const totalDrafts = drafts.length
    const averageCPL = totalDrafts > 0
      ? Math.round((drafts.reduce((sum, draft) => sum + (draft.cpl_score || 0), 0) / totalDrafts) * 10) / 10
      : 0

    // Calculate improvement percentage
    const previousDrafts = cplResult.data || []
    const previousAverageCPL = previousDrafts.length > 0
      ? previousDrafts.reduce((sum, draft) => sum + (draft.cpl_score || 0), 0) / previousDrafts.length
      : averageCPL

    const improvementPercentage = previousAverageCPL > 0
      ? Math.round(((averageCPL - previousAverageCPL) / previousAverageCPL) * 100)
      : 0

    // Get top categories (simplified - you might want to add category tracking)
    const topCategories = [
      { category: 'Professional Email', count: Math.floor(totalInputs * 0.4) },
      { category: 'Creative Writing', count: Math.floor(totalInputs * 0.3) },
      { category: 'Technical Documentation', count: Math.floor(totalInputs * 0.3) }
    ].filter(cat => cat.count > 0)

    // Calculate streak (simplified - you might want to implement proper streak tracking)
    const streakDays = totalInputs > 0 ? Math.min(Math.floor(totalInputs / 2), 30) : 0

    const emailData: UsageSummaryData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name
      },
      period,
      stats: {
        totalInputs,
        totalDrafts,
        averageCPL,
        improvementPercentage: Math.max(0, improvementPercentage),
        topCategories,
        streakDays
      },
      dateRange: {
        start: startDate.toLocaleDateString(),
        end: now.toLocaleDateString()
      }
    }

    const result = await emailService.sendUsageSummary(emailData)

    if (result.success) {
      // Log the email send in the database
      await supabase
        .from('email_logs')
        .insert({
          user_id: userId,
          email_type: 'usage_summary',
          status: 'sent',
          message_id: result.messageId,
          sent_at: new Date().toISOString()
        })
    }

    return result

  } catch (error) {
    console.error('Error sending usage summary email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send usage summary'
    }
  }
}

/**
 * Send CPL milestone achievement email
 */
export async function sendCPLMilestoneEmail(data: z.infer<typeof sendCPLMilestoneSchema>) {
  try {
    const { userId, previousCPL, newCPL, milestone } = sendCPLMilestoneSchema.parse(data)
    const supabase = createClient()

    // Get user data
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return { success: false, error: 'User not found' }
    }

    // Get total drafts count
    const { count: totalDrafts } = await supabase
      .from('generated_drafts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const emailData: CPLMilestoneData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name
      },
      previousCPL,
      newCPL,
      milestone,
      achievementDate: new Date().toISOString(),
      totalDrafts: totalDrafts || 0
    }

    const result = await emailService.sendCPLMilestone(emailData)

    if (result.success) {
      // Log the email send in the database
      await supabase
        .from('email_logs')
        .insert({
          user_id: userId,
          email_type: 'cpl_milestone',
          status: 'sent',
          message_id: result.messageId,
          sent_at: new Date().toISOString()
        })
    }

    return result

  } catch (error) {
    console.error('Error sending CPL milestone email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send CPL milestone email'
    }
  }
}

/**
 * Send feature announcement to multiple users
 */
export async function sendFeatureAnnouncementEmail(data: z.infer<typeof sendFeatureAnnouncementSchema>) {
  try {
    const validatedData = sendFeatureAnnouncementSchema.parse(data)
    const supabase = createClient()

    // Get target users based on criteria
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, email_preferences')

    // Apply targeting logic
    switch (validatedData.targetUsers) {
      case 'active':
        // Users who have used the app in the last 30 days
        query = query.gte('last_sign_in_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        break
      case 'premium':
        // Add premium user logic when implemented
        break
      // 'all' case doesn't need filtering
    }

    const { data: users, error: usersError } = await query

    if (usersError || !users) {
      return { success: false, error: 'Failed to fetch target users' }
    }

    // Filter users who haven't opted out of feature announcements
    const targetUsers = users.filter(user => {
      const prefs = user.email_preferences as any
      return !prefs || prefs.featureAnnouncements !== false
    })

    // Prepare emails
    const emails = targetUsers.map(user => {
      const emailData: FeatureAnnouncementData = {
        user: {
          id: user.id,
          email: user.email,
          name: user.full_name
        },
        ...validatedData
      }

      const template = createFeatureAnnouncementTemplate(emailData)

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.full_name
        },
        subject: template.subject,
        html: template.html,
        text: template.text
      }
    })

    // Send bulk emails
    const results = await emailService.sendBulkEmails(emails, {
      delayMs: 500, // 500ms delay between batches
      maxConcurrent: 10 // 10 concurrent emails
    })

    // Log results
    const emailLogs = results.map(result => ({
      user_id: result.user.id,
      email_type: 'feature_announcement',
      status: result.success ? 'sent' : 'failed',
      message_id: result.messageId,
      error_message: result.error,
      sent_at: new Date().toISOString()
    }))

    await supabase
      .from('email_logs')
      .insert(emailLogs)

    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    return {
      success: true,
      totalSent: successCount,
      totalFailed: failureCount,
      details: results
    }

  } catch (error) {
    console.error('Error sending feature announcement:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send feature announcement'
    }
  }
}

/**
 * Send system notification to users
 */
export async function sendSystemNotificationEmail(data: z.infer<typeof sendSystemNotificationSchema>) {
  try {
    const validatedData = sendSystemNotificationSchema.parse(data)
    const supabase = createClient()

    // Get target users
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, email_preferences')

    // Apply targeting logic similar to feature announcements
    switch (validatedData.targetUsers) {
      case 'active':
        query = query.gte('last_sign_in_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        break
      case 'premium':
        // Add premium user logic when implemented
        break
    }

    const { data: users, error: usersError } = await query

    if (usersError || !users) {
      return { success: false, error: 'Failed to fetch target users' }
    }

    // Filter users who haven't opted out of system notifications
    const targetUsers = users.filter(user => {
      const prefs = user.email_preferences as any
      return !prefs || prefs.systemNotifications !== false
    })

    // Prepare emails
    const emails = targetUsers.map(user => {
      const emailData: SystemNotificationData = {
        user: {
          id: user.id,
          email: user.email,
          name: user.full_name
        },
        ...validatedData
      }

      return emailData
    })

    // Send emails one by one for system notifications (they're usually important)
    const results = []
    for (const emailData of emails) {
      const result = await emailService.sendSystemNotification(emailData)
      results.push({ user: emailData.user, ...result })

      // Log immediately
      await supabase
        .from('email_logs')
        .insert({
          user_id: emailData.user.id,
          email_type: 'system_notification',
          status: result.success ? 'sent' : 'failed',
          message_id: result.messageId,
          error_message: result.error,
          sent_at: new Date().toISOString()
        })
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    return {
      success: true,
      totalSent: successCount,
      totalFailed: failureCount,
      details: results
    }

  } catch (error) {
    console.error('Error sending system notification:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send system notification'
    }
  }
}

/**
 * Get email sending statistics for admin dashboard
 */
export async function getEmailStats() {
  try {
    const supabase = createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user?.user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get email stats for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const { data: stats, error } = await supabase
      .from('email_logs')
      .select('email_type, status, sent_at')
      .gte('sent_at', thirtyDaysAgo.toISOString())

    if (error) {
      return { success: false, error: 'Failed to fetch email stats' }
    }

    // Process stats
    const emailStats = stats.reduce((acc: any, log: any) => {
      const type = log.email_type
      if (!acc[type]) {
        acc[type] = { sent: 0, failed: 0 }
      }
      acc[type][log.status === 'sent' ? 'sent' : 'failed']++
      return acc
    }, {})

    const totalSent = stats.filter(s => s.status === 'sent').length
    const totalFailed = stats.filter(s => s.status === 'failed').length

    return {
      success: true,
      data: {
        totalSent,
        totalFailed,
        byType: emailStats,
        period: '30 days'
      }
    }

  } catch (error) {
    console.error('Error fetching email stats:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch email stats'
    }
  }
}