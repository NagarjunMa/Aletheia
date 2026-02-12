// Performance monitoring system for 3D animations
// Provides real-time FPS, memory, and quality adjustment

export interface PerformanceMetrics {
  fps: number
  memory: number
  frameTime: number
  drawCalls: number
  triangles: number
  timestamp: number
}

export interface QualitySettings {
  pointCount: number
  particleSize: number
  animationFPS: number
  shadowQuality: 'off' | 'low' | 'medium' | 'high'
  lodLevel: 'distant' | 'medium' | 'close' | 'ultra'
}

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra'
export type PerformanceLevel = 'low' | 'medium' | 'high' | 'auto'

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetrics[] = []
  private callbacks: Array<(metrics: PerformanceMetrics) => void> = []
  private rafId: number | null = null
  private lastTime = 0
  private frameCount = 0
  private isMonitoring = false

  // Performance thresholds for quality adjustment
  private readonly THRESHOLDS = {
    TARGET_FPS: 60,
    MIN_FPS: 30,
    HIGH_FPS: 55,
    MEMORY_WARNING: 0.8, // 80% of available memory
    FRAME_TIME_BUDGET: 16.67 // ~60fps in ms
  }

  // Quality presets based on device capabilities
  private readonly QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
    low: {
      pointCount: 100,
      particleSize: 0.02,
      animationFPS: 30,
      shadowQuality: 'off',
      lodLevel: 'distant'
    },
    medium: {
      pointCount: 500,
      particleSize: 0.03,
      animationFPS: 45,
      shadowQuality: 'low',
      lodLevel: 'medium'
    },
    high: {
      pointCount: 2000,
      particleSize: 0.05,
      animationFPS: 60,
      shadowQuality: 'medium',
      lodLevel: 'close'
    },
    ultra: {
      pointCount: 5000,
      particleSize: 0.08,
      animationFPS: 60,
      shadowQuality: 'high',
      lodLevel: 'ultra'
    }
  }

  static getInstance(): PerformanceMonitor {
    if (!this.instance) {
      this.instance = new PerformanceMonitor()
    }
    return this.instance
  }

  startMonitoring(): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    this.lastTime = performance.now()
    this.frameCount = 0
    this.monitorFrame()
  }

  stopMonitoring(): void {
    this.isMonitoring = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private monitorFrame = (): void => {
    if (!this.isMonitoring) return

    const now = performance.now()
    this.frameCount++

    // Calculate FPS every second
    if (now - this.lastTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastTime))
      const frameTime = (now - this.lastTime) / this.frameCount

      const metrics: PerformanceMetrics = {
        fps,
        frameTime,
        memory: this.getMemoryUsage(),
        drawCalls: 0, // Will be populated by Three.js renderer
        triangles: 0, // Will be populated by Three.js renderer
        timestamp: now
      }

      this.updateMetrics(metrics)
      this.frameCount = 0
      this.lastTime = now
    }

    this.rafId = requestAnimationFrame(this.monitorFrame)
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return memory.usedJSHeapSize / memory.jsHeapSizeLimit
    }
    return 0
  }

  private updateMetrics(metrics: PerformanceMetrics): void {
    // Keep last 60 measurements (1 minute at 1fps measurement rate)
    this.metrics.push(metrics)
    if (this.metrics.length > 60) {
      this.metrics.shift()
    }

    // Notify callbacks
    this.callbacks.forEach(callback => callback(metrics))
  }

  onMetricsUpdate(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.callbacks.push(callback)
    return () => {
      const index = this.callbacks.indexOf(callback)
      if (index > -1) this.callbacks.splice(index, 1)
    }
  }

  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null
  }

  getAverageMetrics(samples: number = 10): PerformanceMetrics | null {
    if (this.metrics.length === 0) return null

    const recentMetrics = this.metrics.slice(-samples)
    const avgFps = recentMetrics.reduce((sum, m) => sum + m.fps, 0) / recentMetrics.length
    const avgFrameTime = recentMetrics.reduce((sum, m) => sum + m.frameTime, 0) / recentMetrics.length
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory, 0) / recentMetrics.length

    return {
      fps: Math.round(avgFps),
      frameTime: avgFrameTime,
      memory: avgMemory,
      drawCalls: 0,
      triangles: 0,
      timestamp: performance.now()
    }
  }

  calculateOptimalQuality(): QualityLevel {
    const avgMetrics = this.getAverageMetrics(5)
    if (!avgMetrics) return 'medium'

    // Determine quality based on performance
    if (avgMetrics.fps >= this.THRESHOLDS.HIGH_FPS && avgMetrics.memory < this.THRESHOLDS.MEMORY_WARNING) {
      return 'ultra'
    } else if (avgMetrics.fps >= this.THRESHOLDS.TARGET_FPS && avgMetrics.memory < 0.6) {
      return 'high'
    } else if (avgMetrics.fps >= this.THRESHOLDS.MIN_FPS) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  getQualitySettings(level: QualityLevel): QualitySettings {
    return { ...this.QUALITY_PRESETS[level] }
  }

  shouldReduceQuality(): boolean {
    const avgMetrics = this.getAverageMetrics(3)
    if (!avgMetrics) return false

    return avgMetrics.fps < this.THRESHOLDS.MIN_FPS || avgMetrics.memory > this.THRESHOLDS.MEMORY_WARNING
  }

  shouldIncreaseQuality(): boolean {
    const avgMetrics = this.getAverageMetrics(5)
    if (!avgMetrics) return false

    return avgMetrics.fps >= this.THRESHOLDS.HIGH_FPS && avgMetrics.memory < 0.5
  }

  // Device capability detection
  detectDeviceCapabilities(): {
    gpu: 'low' | 'medium' | 'high'
    memory: number
    cores: number
    webgl: '1' | '2' | 'none'
    webgpu: boolean
  } {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')

    let webglVersion: '1' | '2' | 'none' = 'none'
    let gpuTier: 'low' | 'medium' | 'high' = 'medium'

    if (gl) {
      webglVersion = gl instanceof WebGL2RenderingContext ? '2' : '1'

      // Estimate GPU tier based on renderer info
      const renderer = gl.getParameter(gl.RENDERER)
      const vendor = gl.getParameter(gl.VENDOR)

      // Basic GPU detection (can be enhanced)
      if (renderer.includes('Intel') || renderer.includes('Mali')) {
        gpuTier = 'low'
      } else if (renderer.includes('NVIDIA') || renderer.includes('AMD') || renderer.includes('Radeon')) {
        gpuTier = 'high'
      }
    }

    return {
      gpu: gpuTier,
      memory: (navigator as any).deviceMemory || 4,
      cores: navigator.hardwareConcurrency || 4,
      webgl: webglVersion,
      webgpu: 'gpu' in navigator
    }
  }

  getRecommendedInitialQuality(): QualityLevel {
    const capabilities = this.detectDeviceCapabilities()

    // Mobile detection
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    if (isMobile) {
      return capabilities.gpu === 'high' ? 'medium' : 'low'
    }

    // Desktop quality based on capabilities
    if (capabilities.gpu === 'high' && capabilities.memory >= 8 && capabilities.cores >= 8) {
      return 'ultra'
    } else if (capabilities.gpu === 'high' && capabilities.memory >= 4) {
      return 'high'
    } else if (capabilities.memory >= 4) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  // Cleanup
  destroy(): void {
    this.stopMonitoring()
    this.callbacks = []
    this.metrics = []
  }
}