export interface EmailUser {
  id: string
  email: string
  name?: string
}

export interface EmailTemplate {
  subject: string
  html: string
  text?: string
}

export interface UsageSummaryData {
  user: EmailUser
  period: 'weekly' | 'monthly'
  stats: {
    totalInputs: number
    totalDrafts: number
    averageCPL: number
    improvementPercentage: number
    topCategories: Array<{
      category: string
      count: number
    }>
    streakDays: number
  }
  dateRange: {
    start: string
    end: string
  }
}

export interface CPLMilestoneData {
  user: EmailUser
  previousCPL: number
  newCPL: number
  milestone: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  achievementDate: string
  totalDrafts: number
}

export interface FeatureAnnouncementData {
  user: EmailUser
  title: string
  description: string
  features: Array<{
    name: string
    description: string
    icon?: string
  }>
  ctaText: string
  ctaUrl: string
  imageUrl?: string
}

export interface SystemNotificationData {
  user: EmailUser
  type: 'maintenance' | 'security' | 'feature' | 'billing'
  title: string
  message: string
  action?: {
    text: string
    url: string
  }
  severity: 'info' | 'warning' | 'error'
}

export interface EmailPreferences {
  userId: string
  usageSummary: boolean
  cplMilestones: boolean
  featureAnnouncements: boolean
  systemNotifications: boolean
  frequency: 'weekly' | 'monthly' | 'never'
  createdAt: string
  updatedAt: string
}