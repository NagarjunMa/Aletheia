// Analytics and user behavior tracking

declare global {
  interface Window {
    posthog?: any
    gtag?: (...args: any[]) => void
    dataLayer?: any[]
  }
}

export interface AnalyticsEvent {
  name: string
  properties?: Record<string, any>
  userId?: string
  anonymousId?: string
}

export class Analytics {
  private static initialized = false
  private static userId: string | null = null
  private static sessionId: string | null = null

  // Initialize analytics services
  static initialize(): void {
    if (typeof window === 'undefined' || this.initialized) return

    this.sessionId = this.generateSessionId()

    // Initialize PostHog
    this.initializePostHog()

    // Initialize Google Analytics
    this.initializeGoogleAnalytics()

    // Track page views
    this.trackPageView()

    // Track user engagement
    this.trackEngagement()

    this.initialized = true
    console.log('📊 Analytics initialized')
  }

  // Initialize PostHog
  private static initializePostHog(): void {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

    if (!posthogKey) return

    // Load PostHog script
    const script = document.createElement('script')
    script.src = 'https://app.posthog.com/static/array.js'
    script.async = true
    document.head.appendChild(script)

    script.onload = () => {
      if (window.posthog) {
        window.posthog.init(posthogKey, {
          api_host: posthogHost || 'https://app.posthog.com',
          loaded: (posthog: any) => {
            // Configure PostHog
            posthog.identify(this.userId)

            // Track session start
            this.track('session_start', {
              session_id: this.sessionId,
              user_agent: navigator.userAgent,
              screen_resolution: `${screen.width}x${screen.height}`,
              timestamp: new Date().toISOString()
            })
          }
        })
      }
    }
  }

  // Initialize Google Analytics
  private static initializeGoogleAnalytics(): void {
    const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

    if (!gaId) return

    // Load Google Analytics script
    const script = document.createElement('script')
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
    script.async = true
    document.head.appendChild(script)

    script.onload = () => {
      window.dataLayer = window.dataLayer || []
      window.gtag = function(...args: any[]) {
        window.dataLayer!.push(args)
      }

      window.gtag('js', new Date())
      window.gtag('config', gaId, {
        page_title: document.title,
        page_location: window.location.href
      })
    }
  }

  // Set user ID
  static setUserId(userId: string): void {
    this.userId = userId

    if (window.posthog) {
      window.posthog.identify(userId)
    }

    if (window.gtag) {
      window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        user_id: userId
      })
    }
  }

  // Track events
  static track(eventName: string, properties: Record<string, any> = {}): void {
    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        ...properties,
        session_id: this.sessionId,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
      },
      userId: this.userId || undefined
    }

    // Send to PostHog
    if (window.posthog) {
      window.posthog.capture(eventName, event.properties)
    }

    // Send to Google Analytics
    if (window.gtag) {
      window.gtag('event', eventName, {
        event_category: properties.category || 'user_action',
        event_label: properties.label,
        value: properties.value,
        custom_map: properties
      })
    }

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Analytics Event:', event)
    }

    // Send to Sentry for correlation
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.addBreadcrumb({
        category: 'analytics',
        message: eventName,
        level: 'info',
        data: event.properties
      })
    }
  }

  // Track page views
  static trackPageView(path?: string): void {
    const currentPath = path || (typeof window !== 'undefined' ? window.location.pathname : '/')

    this.track('page_view', {
      page_path: currentPath,
      page_title: typeof document !== 'undefined' ? document.title : '',
      referrer: typeof document !== 'undefined' ? document.referrer : ''
    })
  }

  // Track user engagement metrics
  private static trackEngagement(): void {
    if (typeof window === 'undefined') return

    let startTime = Date.now()
    let isActive = true
    let totalActiveTime = 0

    // Track time on page
    const updateActiveTime = () => {
      if (isActive) {
        totalActiveTime += Date.now() - startTime
      }
      startTime = Date.now()
    }

    // Track when user becomes active/inactive
    const handleVisibilityChange = () => {
      updateActiveTime()
      isActive = !document.hidden

      this.track(isActive ? 'user_active' : 'user_inactive', {
        total_active_time: totalActiveTime
      })
    }

    // Track when user leaves the page
    const handleBeforeUnload = () => {
      updateActiveTime()

      this.track('page_exit', {
        total_time_on_page: totalActiveTime,
        exit_url: window.location.href
      })
    }

    // Track scroll depth
    let maxScrollDepth = 0
    const handleScroll = () => {
      const scrollDepth = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      )

      if (scrollDepth > maxScrollDepth) {
        maxScrollDepth = scrollDepth

        // Track scroll milestones
        if (scrollDepth >= 25 && scrollDepth < 50) {
          this.track('scroll_depth', { depth: '25%' })
        } else if (scrollDepth >= 50 && scrollDepth < 75) {
          this.track('scroll_depth', { depth: '50%' })
        } else if (scrollDepth >= 75 && scrollDepth < 90) {
          this.track('scroll_depth', { depth: '75%' })
        } else if (scrollDepth >= 90) {
          this.track('scroll_depth', { depth: '90%' })
        }
      }
    }

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('scroll', handleScroll, { passive: true })

    // Track initial page engagement
    setTimeout(() => {
      this.track('engaged_user', {
        engagement_type: 'time_based',
        threshold: '10_seconds'
      })
    }, 10000)
  }

  // Track AI-specific events
  static trackAIEvent(event: string, properties: Record<string, any> = {}): void {
    this.track(`ai_${event}`, {
      ...properties,
      category: 'ai_interaction'
    })
  }

  // Track draft generation
  static trackDraftGeneration(properties: {
    inputLength: number
    outputLength: number
    cplScore: number
    draftType: string
    duration: number
  }): void {
    this.trackAIEvent('draft_generated', {
      input_length: properties.inputLength,
      output_length: properties.outputLength,
      cpl_score: properties.cplScore,
      draft_type: properties.draftType,
      generation_duration: properties.duration,
      efficiency_ratio: properties.outputLength / properties.inputLength
    })
  }

  // Track draft acceptance
  static trackDraftAcceptance(properties: {
    draftType: string
    cplScore: number
    timeToDecision: number
    accepted: boolean
  }): void {
    this.trackAIEvent('draft_decision', {
      draft_type: properties.draftType,
      cpl_score: properties.cplScore,
      time_to_decision: properties.timeToDecision,
      decision: properties.accepted ? 'accepted' : 'rejected',
      category: 'user_feedback'
    })
  }

  // Track errors
  static trackError(error: Error, context?: Record<string, any>): void {
    this.track('error_occurred', {
      error_message: error.message,
      error_stack: error.stack,
      error_name: error.name,
      ...context,
      category: 'error'
    })
  }

  // Track performance metrics
  static trackPerformance(metric: string, value: number, unit: string = 'ms'): void {
    this.track('performance_metric', {
      metric_name: metric,
      metric_value: value,
      metric_unit: unit,
      category: 'performance'
    })
  }

  // Track feature usage
  static trackFeatureUsage(feature: string, properties: Record<string, any> = {}): void {
    this.track('feature_used', {
      feature_name: feature,
      ...properties,
      category: 'feature_usage'
    })
  }

  // Track conversion events
  static trackConversion(event: string, properties: Record<string, any> = {}): void {
    this.track(`conversion_${event}`, {
      ...properties,
      category: 'conversion'
    })

    // Also send to Google Analytics as a conversion
    if (window.gtag) {
      window.gtag('event', 'conversion', {
        send_to: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
        event_category: 'conversion',
        event_label: event,
        value: properties.value || 1
      })
    }
  }

  // Track user properties
  static setUserProperties(properties: Record<string, any>): void {
    if (window.posthog) {
      window.posthog.people.set(properties)
    }

    if (window.gtag) {
      window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        custom_map: properties
      })
    }
  }

  // Generate session ID
  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// React hook for analytics
export function useAnalytics() {
  React.useEffect(() => {
    Analytics.initialize()
  }, [])

  return {
    track: Analytics.track,
    trackPageView: Analytics.trackPageView,
    trackAIEvent: Analytics.trackAIEvent,
    trackDraftGeneration: Analytics.trackDraftGeneration,
    trackDraftAcceptance: Analytics.trackDraftAcceptance,
    trackError: Analytics.trackError,
    trackPerformance: Analytics.trackPerformance,
    trackFeatureUsage: Analytics.trackFeatureUsage,
    trackConversion: Analytics.trackConversion,
    setUserId: Analytics.setUserId,
    setUserProperties: Analytics.setUserProperties
  }
}

// Higher-order component for tracking page views
export function withAnalytics<P extends object>(
  Component: React.ComponentType<P>,
  pageName?: string
) {
  return function AnalyticsWrappedComponent(props: P) {
    React.useEffect(() => {
      Analytics.trackPageView()

      if (pageName) {
        Analytics.trackFeatureUsage('page_visit', {
          page_name: pageName
        })
      }
    }, [])

    return <Component {...props} />
  }
}