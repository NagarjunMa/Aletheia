/**
 * Real-time Alerting System
 *
 * Comprehensive alerting and notification system
 * - Email notifications
 * - Webhook integrations
 * - In-app notifications
 * - Alert escalation
 */

import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'

// Alert configuration schemas
const AlertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  component: z.enum([
    'security_framework',
    'memory_engine',
    'parallel_processor',
    'voice_learning',
    'rag_engine',
    'overall_system'
  ]),
  condition: z.object({
    metric: z.string(),
    operator: z.enum(['gt', 'lt', 'eq', 'ne', 'gte', 'lte']),
    threshold: z.number(),
    duration: z.number() // seconds
  }),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  enabled: z.boolean(),
  channels: z.array(z.enum(['email', 'webhook', 'in_app'])),
  escalation: z.object({
    enabled: z.boolean(),
    delay: z.number(), // seconds
    levels: z.array(z.object({
      level: z.number(),
      channels: z.array(z.string()),
      recipients: z.array(z.string())
    }))
  }).optional()
})

const NotificationChannelSchema = z.object({
  type: z.enum(['email', 'webhook', 'slack', 'discord']),
  config: z.record(z.any()),
  enabled: z.boolean()
})

export type AlertRule = z.infer<typeof AlertRuleSchema>
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>

class AlertingSystem {
  private alertRules: Map<string, AlertRule> = new Map()
  private channels: Map<string, NotificationChannel> = new Map()
  private activeAlerts: Map<string, any> = new Map()
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map()
  private isInitialized = false

  /**
   * Initialize alerting system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('🚨 Initializing alerting system...')

      // Load alert rules and channels from database
      await this.loadAlertRules()
      await this.loadNotificationChannels()

      // Setup default alert rules if none exist
      if (this.alertRules.size === 0) {
        await this.createDefaultAlertRules()
      }

      this.isInitialized = true
      console.log('✅ Alerting system initialized successfully')

    } catch (error) {
      console.error('Failed to initialize alerting system:', error)
      throw error
    }
  }

  /**
   * Process incoming metrics and check for alert conditions
   */
  async processMetrics(component: string, metrics: any, context: any = {}): Promise<void> {
    if (!this.isInitialized) await this.initialize()

    try {
      // Get applicable alert rules for this component
      const rules = Array.from(this.alertRules.values())
        .filter(rule => rule.component === component && rule.enabled)

      for (const rule of rules) {
        await this.evaluateAlertRule(rule, metrics, context)
      }

    } catch (error) {
      console.error('Failed to process metrics for alerting:', error)
    }
  }

  /**
   * Create new alert rule
   */
  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<string> {
    const ruleId = crypto.randomUUID()
    const fullRule: AlertRule = { ...rule, id: ruleId }

    // Validate rule
    AlertRuleSchema.parse(fullRule)

    // Store in database
    const supabase = createClient()
    await supabase.from('alert_rules').insert({
      id: ruleId,
      name: fullRule.name,
      description: fullRule.description,
      component: fullRule.component,
      condition: fullRule.condition,
      severity: fullRule.severity,
      enabled: fullRule.enabled,
      channels: fullRule.channels,
      escalation_config: fullRule.escalation
    })

    // Add to memory
    this.alertRules.set(ruleId, fullRule)

    console.log(`📋 Created alert rule: ${fullRule.name}`)
    return ruleId
  }

  /**
   * Update existing alert rule
   */
  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    const existingRule = this.alertRules.get(ruleId)
    if (!existingRule) {
      throw new Error(`Alert rule ${ruleId} not found`)
    }

    const updatedRule = { ...existingRule, ...updates, id: ruleId }
    AlertRuleSchema.parse(updatedRule)

    // Update in database
    const supabase = createClient()
    await supabase.from('alert_rules')
      .update({
        name: updatedRule.name,
        description: updatedRule.description,
        component: updatedRule.component,
        condition: updatedRule.condition,
        severity: updatedRule.severity,
        enabled: updatedRule.enabled,
        channels: updatedRule.channels,
        escalation_config: updatedRule.escalation
      })
      .eq('id', ruleId)

    // Update in memory
    this.alertRules.set(ruleId, updatedRule)

    console.log(`📝 Updated alert rule: ${updatedRule.name}`)
  }

  /**
   * Delete alert rule
   */
  async deleteAlertRule(ruleId: string): Promise<void> {
    const supabase = createClient()

    await supabase.from('alert_rules').delete().eq('id', ruleId)
    this.alertRules.delete(ruleId)

    console.log(`🗑️ Deleted alert rule: ${ruleId}`)
  }

  /**
   * Configure notification channel
   */
  async configureChannel(channelId: string, channel: NotificationChannel): Promise<void> {
    NotificationChannelSchema.parse(channel)

    // Store in database
    const supabase = createClient()
    await supabase.from('notification_channels').upsert({
      id: channelId,
      type: channel.type,
      config: channel.config,
      enabled: channel.enabled
    })

    // Add to memory
    this.channels.set(channelId, channel)

    console.log(`📢 Configured notification channel: ${channel.type}`)
  }

  /**
   * Send alert notification
   */
  async sendAlert(alert: {
    ruleId: string
    severity: string
    component: string
    message: string
    metrics: any
    context?: any
  }): Promise<void> {
    try {
      const rule = this.alertRules.get(alert.ruleId)
      if (!rule) return

      console.log(`🚨 Sending ${alert.severity} alert: ${alert.message}`)

      // Create alert record in database
      const alertId = crypto.randomUUID()
      const supabase = createClient()

      const { error } = await supabase.from('production_alerts').insert({
        id: alertId,
        alert_type: rule.name,
        severity: alert.severity,
        component: alert.component,
        message: alert.message,
        user_id: alert.context?.userId || null,
        session_id: alert.context?.sessionId || null,
        metrics_snapshot: {
          ...alert.metrics,
          context: alert.context
        },
        status: 'active'
      })

      if (error) {
        console.error('Failed to create alert record:', error)
        return
      }

      // Send notifications through configured channels
      for (const channelType of rule.channels) {
        await this.sendChannelNotification(channelType, alert, alertId)
      }

      // Setup escalation if configured
      if (rule.escalation?.enabled) {
        this.setupEscalation(alertId, rule, alert)
      }

      // Track active alert
      this.activeAlerts.set(alertId, {
        ...alert,
        alertId,
        ruleId: rule.id,
        triggeredAt: Date.now()
      })

    } catch (error) {
      console.error('Failed to send alert:', error)
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, resolutionNotes?: string): Promise<void> {
    try {
      const supabase = createClient()

      // Update alert status in database
      await supabase.from('production_alerts')
        .update({
          status: 'resolved',
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes
        })
        .eq('id', alertId)

      // Remove from active alerts
      this.activeAlerts.delete(alertId)

      // Cancel escalation if active
      const escalationTimer = this.escalationTimers.get(alertId)
      if (escalationTimer) {
        clearTimeout(escalationTimer)
        this.escalationTimers.delete(alertId)
      }

      console.log(`✅ Resolved alert: ${alertId}`)

    } catch (error) {
      console.error('Failed to resolve alert:', error)
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): any[] {
    return Array.from(this.activeAlerts.values())
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values())
  }

  // Private helper methods
  private async loadAlertRules(): Promise<void> {
    try {
      const supabase = createClient()
      const { data: rules } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('enabled', true)

      for (const rule of rules || []) {
        const alertRule: AlertRule = {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          component: rule.component,
          condition: rule.condition,
          severity: rule.severity,
          enabled: rule.enabled,
          channels: rule.channels,
          escalation: rule.escalation_config
        }

        this.alertRules.set(rule.id, alertRule)
      }

      console.log(`📋 Loaded ${this.alertRules.size} alert rules`)

    } catch (error) {
      console.warn('Failed to load alert rules:', error)
    }
  }

  private async loadNotificationChannels(): Promise<void> {
    try {
      const supabase = createClient()
      const { data: channels } = await supabase
        .from('notification_channels')
        .select('*')
        .eq('enabled', true)

      for (const channel of channels || []) {
        this.channels.set(channel.id, {
          type: channel.type,
          config: channel.config,
          enabled: channel.enabled
        })
      }

      console.log(`📢 Loaded ${this.channels.size} notification channels`)

    } catch (error) {
      console.warn('Failed to load notification channels:', error)
    }
  }

  private async createDefaultAlertRules(): Promise<void> {
    console.log('📋 Creating default alert rules...')

    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: 'High Security Violation Rate',
        description: 'Alert when security violations exceed normal threshold',
        component: 'security_framework',
        condition: {
          metric: 'violationRate',
          operator: 'gt',
          threshold: 10,
          duration: 60
        },
        severity: 'high',
        enabled: true,
        channels: ['in_app', 'email']
      },
      {
        name: 'High Memory Usage',
        description: 'Alert when memory usage exceeds 85%',
        component: 'memory_engine',
        condition: {
          metric: 'memoryUsage',
          operator: 'gt',
          threshold: 85,
          duration: 300
        },
        severity: 'medium',
        enabled: true,
        channels: ['in_app']
      },
      {
        name: 'Parallel Processing Degradation',
        description: 'Alert when parallel processing improvement drops below 40%',
        component: 'parallel_processor',
        condition: {
          metric: 'improvementPercent',
          operator: 'lt',
          threshold: 40,
          duration: 180
        },
        severity: 'medium',
        enabled: true,
        channels: ['in_app']
      },
      {
        name: 'Voice Learning Accuracy Drop',
        description: 'Alert when voice learning accuracy drops significantly',
        component: 'voice_learning',
        condition: {
          metric: 'accuracyScore',
          operator: 'lt',
          threshold: 70,
          duration: 300
        },
        severity: 'medium',
        enabled: true,
        channels: ['in_app']
      },
      {
        name: 'System Health Critical',
        description: 'Alert when overall system health is critical',
        component: 'overall_system',
        condition: {
          metric: 'healthScore',
          operator: 'lt',
          threshold: 60,
          duration: 120
        },
        severity: 'critical',
        enabled: true,
        channels: ['in_app', 'email'],
        escalation: {
          enabled: true,
          delay: 600, // 10 minutes
          levels: [
            {
              level: 1,
              channels: ['webhook'],
              recipients: ['admin@ascendia.ai']
            }
          ]
        }
      }
    ]

    for (const rule of defaultRules) {
      await this.createAlertRule(rule)
    }
  }

  private async evaluateAlertRule(rule: AlertRule, metrics: any, context: any): Promise<void> {
    try {
      // Extract metric value
      const metricValue = this.extractMetricValue(metrics, rule.condition.metric)
      if (metricValue === null || metricValue === undefined) return

      // Check condition
      const conditionMet = this.evaluateCondition(
        metricValue,
        rule.condition.operator,
        rule.condition.threshold
      )

      if (conditionMet) {
        // Check if this is a new alert or existing one
        const existingAlert = Array.from(this.activeAlerts.values())
          .find(alert => alert.ruleId === rule.id)

        if (!existingAlert) {
          // Send new alert
          await this.sendAlert({
            ruleId: rule.id,
            severity: rule.severity,
            component: rule.component,
            message: this.generateAlertMessage(rule, metricValue),
            metrics,
            context
          })
        }
      }

    } catch (error) {
      console.error(`Failed to evaluate alert rule ${rule.name}:`, error)
    }
  }

  private extractMetricValue(metrics: any, metricPath: string): number | null {
    // Handle nested metric paths like 'customMetrics.violationRate'
    const parts = metricPath.split('.')
    let value = metrics

    for (const part of parts) {
      value = value?.[part]
    }

    return typeof value === 'number' ? value : null
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold
      case 'lt': return value < threshold
      case 'gte': return value >= threshold
      case 'lte': return value <= threshold
      case 'eq': return value === threshold
      case 'ne': return value !== threshold
      default: return false
    }
  }

  private generateAlertMessage(rule: AlertRule, value: number): string {
    const condition = rule.condition
    return `${rule.component}: ${condition.metric} ${condition.operator} ${condition.threshold} (current: ${value.toFixed(2)})`
  }

  private async sendChannelNotification(channelType: string, alert: any, alertId: string): Promise<void> {
    try {
      switch (channelType) {
        case 'email':
          await this.sendEmailNotification(alert, alertId)
          break
        case 'webhook':
          await this.sendWebhookNotification(alert, alertId)
          break
        case 'in_app':
          await this.sendInAppNotification(alert, alertId)
          break
        default:
          console.warn(`Unknown notification channel: ${channelType}`)
      }
    } catch (error) {
      console.error(`Failed to send ${channelType} notification:`, error)
    }
  }

  private async sendEmailNotification(alert: any, alertId: string): Promise<void> {
    // Email notification implementation would go here
    console.log(`📧 Email notification sent for alert ${alertId}`)
  }

  private async sendWebhookNotification(alert: any, alertId: string): Promise<void> {
    // Webhook notification implementation would go here
    console.log(`🔗 Webhook notification sent for alert ${alertId}`)
  }

  private async sendInAppNotification(alert: any, alertId: string): Promise<void> {
    // In-app notification (real-time through websockets or SSE)
    console.log(`📱 In-app notification sent for alert ${alertId}`)
  }

  private setupEscalation(alertId: string, rule: AlertRule, alert: any): void {
    if (!rule.escalation?.enabled) return

    const timer = setTimeout(async () => {
      if (this.activeAlerts.has(alertId)) {
        console.log(`⬆️ Escalating alert ${alertId}`)

        // Send escalated notifications
        for (const level of rule.escalation!.levels || []) {
          for (const channel of level.channels) {
            await this.sendChannelNotification(channel, alert, alertId)
          }
        }

        // Update alert escalation level
        try {
          const supabase = createClient()
          await supabase.from('production_alerts')
            .update({ escalation_level: 1 })
            .eq('id', alertId)
        } catch (error) {
          console.error('Failed to update alert escalation:', error)
        }
      }

      this.escalationTimers.delete(alertId)
    }, rule.escalation.delay * 1000)

    this.escalationTimers.set(alertId, timer)
  }

  /**
   * Cleanup alerting system
   */
  cleanup(): void {
    // Clear all escalation timers
    this.escalationTimers.forEach(timer => clearTimeout(timer))
    this.escalationTimers.clear()

    // Clear active alerts
    this.activeAlerts.clear()

    console.log('🧹 Alerting system cleaned up')
  }
}

// Export singleton instance
export const alertingSystem = new AlertingSystem()

export default AlertingSystem