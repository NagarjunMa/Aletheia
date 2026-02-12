// Main service
export { emailService, EmailService } from './service'

// Types
export type {
  EmailUser,
  EmailTemplate,
  UsageSummaryData,
  CPLMilestoneData,
  FeatureAnnouncementData,
  SystemNotificationData,
  EmailPreferences
} from './types'

// Templates (for direct usage if needed)
export { createUsageSummaryTemplate } from './templates/usage-summary'
export { createCPLMilestoneTemplate } from './templates/cpl-milestone'
export { createFeatureAnnouncementTemplate } from './templates/feature-announcement'

// Configuration
export { EMAIL_CONFIG } from './client'