// Level of Detail (LOD) Management System
// Dynamically adjusts 3D detail based on distance, performance, and device capabilities

import { Vector3 } from 'three'
import type { QualityLevel, QualitySettings } from './performance-monitor'

export interface LODLevel {
  name: string
  distance: number
  pointCount: number
  particleSize: number
  animationComplexity: number
  renderQuality: number
}

export interface ViewportInfo {
  cameraPosition: Vector3
  targetPosition: Vector3
  distance: number
  frustumSize: number
  viewportSize: { width: number; height: number }
}

export interface LODConfiguration {
  levels: LODLevel[]
  transitionSpeed: number
  hysteresis: number // Prevents rapid switching
  performanceWeight: number // How much performance affects LOD
}

export class LODManager {
  private static instance: LODManager
  private currentLevel: LODLevel
  private targetLevel: LODLevel
  private lastUpdateTime = 0
  private transitionProgress = 0
  private lastDistanceCheck = 0
  private distanceCheckInterval = 100 // ms

  // Default LOD configuration
  private readonly DEFAULT_CONFIG: LODConfiguration = {
    levels: [
      {
        name: 'distant',
        distance: 15,
        pointCount: 100,
        particleSize: 0.02,
        animationComplexity: 0.3,
        renderQuality: 0.5
      },
      {
        name: 'medium',
        distance: 10,
        pointCount: 500,
        particleSize: 0.03,
        animationComplexity: 0.6,
        renderQuality: 0.7
      },
      {
        name: 'close',
        distance: 5,
        pointCount: 2000,
        particleSize: 0.05,
        animationComplexity: 0.85,
        renderQuality: 0.9
      },
      {
        name: 'ultra',
        distance: 0,
        pointCount: 5000,
        particleSize: 0.08,
        animationComplexity: 1.0,
        renderQuality: 1.0
      }
    ],
    transitionSpeed: 2.0, // levels per second
    hysteresis: 0.2, // 20% buffer to prevent oscillation
    performanceWeight: 0.7 // 70% performance, 30% distance
  }

  private config: LODConfiguration = this.DEFAULT_CONFIG

  static getInstance(): LODManager {
    if (!this.instance) {
      this.instance = new LODManager()
    }
    return this.instance
  }

  constructor() {
    this.currentLevel = this.config.levels[1] // Start with medium
    this.targetLevel = this.currentLevel
  }

  updateLOD(
    viewport: ViewportInfo,
    performance: { fps: number; memory: number },
    qualityOverride?: QualityLevel
  ): LODLevel {
    const now = performance.now || Date.now()

    // Only check distance periodically to reduce CPU overhead
    if (now - this.lastDistanceCheck > this.distanceCheckInterval) {
      this.updateTargetLevel(viewport, performance, qualityOverride)
      this.lastDistanceCheck = now
    }

    // Smooth transition between levels
    if (this.currentLevel !== this.targetLevel) {
      this.updateTransition(now)
    }

    return this.getCurrentInterpolatedLevel()
  }

  private updateTargetLevel(
    viewport: ViewportInfo,
    performance: { fps: number; memory: number },
    qualityOverride?: QualityLevel
  ): void {
    let targetLevel: LODLevel

    if (qualityOverride) {
      // Override based on quality setting
      targetLevel = this.getLevelForQuality(qualityOverride)
    } else {
      // Calculate based on distance and performance
      const distanceLevel = this.getLevelForDistance(viewport.distance)
      const performanceLevel = this.getLevelForPerformance(performance)

      // Weighted combination
      targetLevel = this.combineLevels(
        distanceLevel,
        performanceLevel,
        this.config.performanceWeight
      )
    }

    // Apply hysteresis to prevent rapid switching
    if (this.shouldSwitchLevel(targetLevel)) {
      this.targetLevel = targetLevel
      this.transitionProgress = 0
    }
  }

  private getLevelForDistance(distance: number): LODLevel {
    // Find appropriate level based on distance
    for (let i = this.config.levels.length - 1; i >= 0; i--) {
      if (distance >= this.config.levels[i].distance) {
        return this.config.levels[i]
      }
    }
    return this.config.levels[0] // Fallback to lowest detail
  }

  private getLevelForPerformance(performance: { fps: number; memory: number }): LODLevel {
    const performanceScore = this.calculatePerformanceScore(performance)

    // Map performance score (0-1) to LOD level
    const levelIndex = Math.floor(performanceScore * this.config.levels.length)
    return this.config.levels[Math.min(levelIndex, this.config.levels.length - 1)]
  }

  private calculatePerformanceScore(performance: { fps: number; memory: number }): number {
    // Normalize FPS (30fps = 0, 60fps = 1)
    const fpsScore = Math.max(0, Math.min(1, (performance.fps - 30) / 30))

    // Normalize memory (0% = 1, 80% = 0)
    const memoryScore = Math.max(0, 1 - (performance.memory / 0.8))

    // Combine scores (weighted towards FPS)
    return fpsScore * 0.7 + memoryScore * 0.3
  }

  private combineLevels(
    distanceLevel: LODLevel,
    performanceLevel: LODLevel,
    performanceWeight: number
  ): LODLevel {
    const distanceIndex = this.config.levels.indexOf(distanceLevel)
    const performanceIndex = this.config.levels.indexOf(performanceLevel)

    // Weighted average of level indices
    const combinedIndex = Math.round(
      distanceIndex * (1 - performanceWeight) + performanceIndex * performanceWeight
    )

    return this.config.levels[Math.max(0, Math.min(combinedIndex, this.config.levels.length - 1))]
  }

  private shouldSwitchLevel(newLevel: LODLevel): boolean {
    const currentIndex = this.config.levels.indexOf(this.currentLevel)
    const newIndex = this.config.levels.indexOf(newLevel)
    const indexDiff = Math.abs(newIndex - currentIndex)

    // Require larger difference to switch to prevent oscillation
    return indexDiff > this.config.hysteresis
  }

  private updateTransition(now: number): void {
    if (this.lastUpdateTime === 0) {
      this.lastUpdateTime = now
      return
    }

    const deltaTime = (now - this.lastUpdateTime) / 1000 // Convert to seconds
    this.transitionProgress += deltaTime * this.config.transitionSpeed

    if (this.transitionProgress >= 1.0) {
      this.currentLevel = this.targetLevel
      this.transitionProgress = 1.0
    }

    this.lastUpdateTime = now
  }

  private getCurrentInterpolatedLevel(): LODLevel {
    if (this.transitionProgress >= 1.0 || this.currentLevel === this.targetLevel) {
      return this.currentLevel
    }

    // Linear interpolation between current and target levels
    const t = this.easeInOutCubic(this.transitionProgress)

    return {
      name: this.targetLevel.name,
      distance: this.lerp(this.currentLevel.distance, this.targetLevel.distance, t),
      pointCount: Math.round(this.lerp(this.currentLevel.pointCount, this.targetLevel.pointCount, t)),
      particleSize: this.lerp(this.currentLevel.particleSize, this.targetLevel.particleSize, t),
      animationComplexity: this.lerp(this.currentLevel.animationComplexity, this.targetLevel.animationComplexity, t),
      renderQuality: this.lerp(this.currentLevel.renderQuality, this.targetLevel.renderQuality, t)
    }
  }

  private getLevelForQuality(quality: QualityLevel): LODLevel {
    const qualityMap: Record<QualityLevel, number> = {
      low: 0,
      medium: 1,
      high: 2,
      ultra: 3
    }

    const index = qualityMap[quality]
    return this.config.levels[Math.min(index, this.config.levels.length - 1)]
  }

  // Utility functions
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  // Public API
  getCurrentLevel(): LODLevel {
    return this.currentLevel
  }

  getTargetLevel(): LODLevel {
    return this.targetLevel
  }

  isTransitioning(): boolean {
    return this.transitionProgress < 1.0 && this.currentLevel !== this.targetLevel
  }

  getTransitionProgress(): number {
    return this.transitionProgress
  }

  // Force immediate level change (for manual overrides)
  forceLevel(level: LODLevel): void {
    this.currentLevel = level
    this.targetLevel = level
    this.transitionProgress = 1.0
  }

  // Update configuration
  updateConfig(newConfig: Partial<LODConfiguration>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // Get level statistics
  getLevelStats(): {
    current: string
    target: string
    transitionProgress: number
    levels: LODLevel[]
  } {
    return {
      current: this.currentLevel.name,
      target: this.targetLevel.name,
      transitionProgress: this.transitionProgress,
      levels: [...this.config.levels]
    }
  }

  // Predefined quality configurations
  static createQualityConfig(quality: QualityLevel): LODConfiguration {
    const baseConfig = LODManager.getInstance().DEFAULT_CONFIG

    const qualityModifiers = {
      low: { pointMultiplier: 0.2, qualityMultiplier: 0.5 },
      medium: { pointMultiplier: 0.5, qualityMultiplier: 0.7 },
      high: { pointMultiplier: 1.0, qualityMultiplier: 1.0 },
      ultra: { pointMultiplier: 2.0, qualityMultiplier: 1.2 }
    }

    const modifier = qualityModifiers[quality]

    return {
      ...baseConfig,
      levels: baseConfig.levels.map(level => ({
        ...level,
        pointCount: Math.round(level.pointCount * modifier.pointMultiplier),
        renderQuality: Math.min(1.0, level.renderQuality * modifier.qualityMultiplier)
      }))
    }
  }
}