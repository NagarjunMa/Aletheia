'use client'

import { useEffect } from 'react'
import { monitoringSystem } from '@/lib/monitoring'

interface MonitoringProviderProps {
  children: React.ReactNode
}

export function MonitoringProvider({ children }: MonitoringProviderProps) {
  useEffect(() => {
    let initialized = false

    const initializeMonitoring = async () => {
      if (initialized) return
      initialized = true

      try {
        // Initialize monitoring system in production and development
        console.log('🚀 Initializing Ascendia Monitoring System...')
        await monitoringSystem.initialize()

        // Start metric collection
        await monitoringSystem.start()

        console.log('✅ Monitoring system ready')
      } catch (error) {
        console.warn('⚠️ Monitoring system initialization failed:', error)
        // Continue without monitoring - don't break the app
      }
    }

    // Initialize monitoring
    initializeMonitoring()

    // Cleanup on unmount
    return () => {
      monitoringSystem.cleanup().catch(error => {
        console.warn('Failed to cleanup monitoring:', error)
      })
    }
  }, [])

  // Monitor page visibility for analytics
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User left the page - track session data
        monitoringSystem.trackComponentMetrics(
          'overall_system',
          'session_end',
          {
            latency: 0,
            success: true,
            customMetrics: {
              sessionDuration: Date.now() - (window as any).__sessionStart || 0,
              pageVisibility: 'hidden'
            }
          }
        ).catch(error => {
          console.debug('Session tracking failed:', error)
        })
      } else if (document.visibilityState === 'visible') {
        // User returned to page
        ;(window as any).__sessionStart = Date.now()
        monitoringSystem.trackComponentMetrics(
          'overall_system',
          'session_start',
          {
            latency: 0,
            success: true,
            customMetrics: {
              pageVisibility: 'visible'
            }
          }
        ).catch(error => {
          console.debug('Session tracking failed:', error)
        })
      }
    }

    // Set initial session start time
    ;(window as any).__sessionStart = Date.now()

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return <>{children}</>
}