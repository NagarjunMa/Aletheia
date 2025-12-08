'use server'

import { createClient, getUser, getUserProfile } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  profileUpdateSchema,
  preferencesSchema,
  userFeedbackSchema,
  analyticsEventSchema,
  exportDataSchema,
  type ProfileUpdate,
  type UserPreferences,
  type UserFeedback,
  type AnalyticsEvent,
  type ExportData
} from '@/lib/validations/schemas'
import type { Database } from '@/lib/database/types'

type Profile = Database['public']['Tables']['profiles']['Row']
type UserFeedbackInsert = Database['public']['Tables']['user_feedback']['Insert']

// Update user profile
export async function updateUserProfile(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Parse and validate form data
    const rawData = {
      full_name: formData.get('full_name') as string,
      email: formData.get('email') as string,
      avatar_url: formData.get('avatar_url') as string || null,
      preferences: formData.get('preferences') ?
        JSON.parse(formData.get('preferences') as string) : undefined,
    }

    const validatedData = profileUpdateSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { full_name, email, avatar_url, preferences } = validatedData.data
    const supabase = createClient()

    // Update the profile
    const updateData: any = {
      full_name,
      email,
      updated_at: new Date().toISOString(),
    }

    if (avatar_url !== undefined) {
      updateData.avatar_url = avatar_url
    }

    if (preferences) {
      updateData.preferences = preferences
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Profile update error:', error)
      return {
        success: false,
        error: 'Failed to update profile',
      }
    }

    revalidatePath('/profile')
    revalidatePath('/settings')

    return {
      success: true,
      data,
      message: 'Profile updated successfully',
    }
  } catch (error) {
    console.error('Update profile error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Update user preferences
export async function updateUserPreferences(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Parse and validate form data
    const rawPreferences = formData.get('preferences') as string
    const preferences = JSON.parse(rawPreferences)

    const validatedData = preferencesSchema.safeParse(preferences)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const supabase = createClient()

    // Get current profile to merge preferences
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single()

    if (fetchError) {
      console.error('Fetch profile error:', fetchError)
      return {
        success: false,
        error: 'Failed to fetch current preferences',
      }
    }

    // Merge with existing preferences
    const mergedPreferences = {
      ...currentProfile?.preferences,
      ...validatedData.data,
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        preferences: mergedPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Preferences update error:', error)
      return {
        success: false,
        error: 'Failed to update preferences',
      }
    }

    revalidatePath('/settings')
    revalidatePath('/profile')

    return {
      success: true,
      data,
      message: 'Preferences updated successfully',
    }
  } catch (error) {
    console.error('Update preferences error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get user dashboard statistics
export async function getUserDashboardStats() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        data: null,
      }
    }

    const supabase = createClient()

    // Use the dashboard stats view if it exists, otherwise calculate manually
    const { data: statsData, error: statsError } = await supabase
      .from('user_dashboard_stats')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (statsError) {
      // If view doesn't exist, calculate manually
      const [
        conversationsResult,
        inputsResult,
        draftsResult,
        avgCplResult
      ] = await Promise.all([
        // Total conversations
        supabase
          .from('conversations')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .neq('status', 'deleted'),

        // Total inputs
        supabase
          .from('user_inputs')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .neq('processing_status', 'deleted'),

        // Total drafts
        supabase
          .from('generated_drafts')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),

        // Average CPL score
        supabase
          .from('generated_drafts')
          .select('cpl_score')
          .eq('user_id', user.id)
          .not('cpl_score', 'is', null)
      ])

      const totalConversations = conversationsResult.count || 0
      const totalInputs = inputsResult.count || 0
      const totalDrafts = draftsResult.count || 0

      const avgCpl = avgCplResult.data && avgCplResult.data.length > 0
        ? avgCplResult.data.reduce((sum, item) => sum + (item.cpl_score || 0), 0) / avgCplResult.data.length
        : 0

      return {
        success: true,
        data: {
          user_id: user.id,
          total_conversations: totalConversations,
          total_inputs: totalInputs,
          total_drafts: totalDrafts,
          avg_cpl_score: Math.round(avgCpl),
          last_activity: new Date().toISOString(),
        },
      }
    }

    return {
      success: true,
      data: statsData,
    }
  } catch (error) {
    console.error('Get dashboard stats error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: null,
    }
  }
}

// Submit user feedback
export async function submitUserFeedback(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Parse and validate form data
    const rawData = {
      feedback_type: formData.get('feedback_type') as 'bug_report' | 'feature_request' | 'general_feedback' | 'user_experience',
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string || undefined,
      priority: (formData.get('priority') as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
      attachments: formData.get('attachments') ?
        JSON.parse(formData.get('attachments') as string) : undefined,
      contact_email: formData.get('contact_email') as string || undefined,
    }

    const validatedData = userFeedbackSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const feedbackData = validatedData.data
    const supabase = createClient()

    // Insert feedback
    const { data, error } = await supabase
      .from('user_feedback')
      .insert({
        user_id: user.id,
        feedback_type: feedbackData.feedback_type,
        title: feedbackData.title,
        description: feedbackData.description,
        category: feedbackData.category || null,
        priority: feedbackData.priority,
        metadata: {
          attachments: feedbackData.attachments || [],
          contact_email: feedbackData.contact_email,
          user_agent: 'web_app', // This would be filled by client
          submitted_from: 'web_app',
        },
      })
      .select()
      .single()

    if (error) {
      console.error('Submit feedback error:', error)
      return {
        success: false,
        error: 'Failed to submit feedback',
      }
    }

    return {
      success: true,
      data,
      message: 'Feedback submitted successfully',
    }
  } catch (error) {
    console.error('Submit feedback error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Log analytics event
export async function logAnalyticsEvent(formData: FormData) {
  try {
    const user = await getUser()

    // Parse and validate form data
    const rawData = {
      event_type: formData.get('event_type') as 'page_view' | 'user_action' | 'feature_usage' | 'error_encountered' | 'performance_metric',
      event_name: formData.get('event_name') as string,
      properties: formData.get('properties') ?
        JSON.parse(formData.get('properties') as string) : undefined,
      user_id: user?.id,
      session_id: formData.get('session_id') as string || undefined,
      timestamp: formData.get('timestamp') as string || new Date().toISOString(),
    }

    const validatedData = analyticsEventSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    // Note: In a production app, you might send this to an external analytics service
    // like PostHog, Mixpanel, or Google Analytics instead of storing in your database

    console.log('Analytics event:', validatedData.data)

    return {
      success: true,
      message: 'Event logged successfully',
    }
  } catch (error) {
    console.error('Log analytics event error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Export user data
export async function exportUserData(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Parse and validate form data
    const rawData = {
      data_types: JSON.parse(formData.get('data_types') as string),
      date_range: formData.get('date_range') ?
        JSON.parse(formData.get('date_range') as string) : undefined,
      format: (formData.get('format') as 'json' | 'csv' | 'pdf') || 'json',
      include_metadata: formData.get('include_metadata') === 'true',
    }

    const validatedData = exportDataSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { data_types, date_range, format, include_metadata } = validatedData.data
    const supabase = createClient()

    const exportData: any = {}

    // Export requested data types
    for (const dataType of data_types) {
      let query = supabase.from(dataType).select('*').eq('user_id', user.id)

      // Apply date range filter if specified
      if (date_range) {
        query = query
          .gte('created_at', date_range.start_date)
          .lte('created_at', date_range.end_date)
      }

      const { data, error } = await query

      if (error) {
        console.error(`Export ${dataType} error:`, error)
        return {
          success: false,
          error: `Failed to export ${dataType}`,
        }
      }

      exportData[dataType] = data
    }

    // Add metadata if requested
    if (include_metadata) {
      exportData.metadata = {
        export_date: new Date().toISOString(),
        user_id: user.id,
        data_types,
        format,
        total_records: Object.values(exportData).flat().length,
      }
    }

    // Note: In production, you might want to create a download link or email the export
    return {
      success: true,
      data: exportData,
      message: 'Data exported successfully',
    }
  } catch (error) {
    console.error('Export user data error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Update user CPL score (called internally)
export async function updateUserCPLScore(userId: string, newScore: number) {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('profiles')
      .update({
        cpl_score: newScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Update CPL score error:', error)
      return {
        success: false,
        error: 'Failed to update CPL score',
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error('Update CPL score error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get user activity summary
export async function getUserActivitySummary(days = 30) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        data: null,
      }
    }

    const supabase = createClient()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const [
      recentConversations,
      recentInputs,
      recentDrafts
    ] = await Promise.all([
      // Recent conversations
      supabase
        .from('conversations')
        .select('id, title, category, created_at')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(10),

      // Recent inputs
      supabase
        .from('user_inputs')
        .select('id, input_text, created_at, conversations!inner(title)')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(10),

      // Recent drafts with ratings
      supabase
        .from('generated_drafts')
        .select('id, draft_type, cpl_score, user_rating, created_at')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(10)
    ])

    return {
      success: true,
      data: {
        period_days: days,
        recent_conversations: recentConversations.data || [],
        recent_inputs: recentInputs.data || [],
        recent_drafts: recentDrafts.data || [],
        summary: {
          conversations_created: recentConversations.count || 0,
          inputs_created: recentInputs.count || 0,
          drafts_generated: recentDrafts.count || 0,
        }
      },
    }
  } catch (error) {
    console.error('Get activity summary error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: null,
    }
  }
}

// Delete user account (with confirmation)
export async function deleteUserAccount(confirmationText: string) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Verify confirmation text
    if (confirmationText !== 'DELETE MY ACCOUNT') {
      return {
        success: false,
        error: 'Invalid confirmation text',
      }
    }

    const supabase = createClient()

    // Note: Due to RLS policies and foreign key constraints,
    // deleting the profile will cascade delete all user data
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id)

    if (error) {
      console.error('Delete account error:', error)
      return {
        success: false,
        error: 'Failed to delete account',
      }
    }

    // Also delete the auth user
    await supabase.auth.admin.deleteUser(user.id)

    return {
      success: true,
      message: 'Account deleted successfully',
    }
  } catch (error) {
    console.error('Delete account error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}