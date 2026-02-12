// Progressive Geometry Generator for Binary Globe
// Efficiently generates particle positions using Fibonacci sphere distribution

import { Vector3 } from 'three'

export interface ParticleData {
  id: string
  position: Vector3
  originalPosition: Vector3
  isContinent: boolean
  animationDelay: number
  size: number
  category: 'continent' | 'ocean' | 'connection' | 'data'
  metadata: Record<string, unknown>
}

export interface ContinentRegion {
  name: string
  centerLat: number
  centerLon: number
  size: number
  density: number
  priority: number
}

export interface GenerationOptions {
  pointCount: number
  radius: number
  continentRegions: ContinentRegion[]
  oceanDensity: number
  connectionPoints: number
  animationSpread: number
  qualityLevel: number // 0-1, affects point distribution quality
}

export class GeometryGenerator {
  private static instance: GeometryGenerator
  private cache = new Map<string, ParticleData[]>()
  private maxCacheSize = 10

  // Predefined continent regions with realistic geography
  private static readonly DEFAULT_CONTINENTS: ContinentRegion[] = [
    // North America
    { name: 'NA_West', centerLat: 45, centerLon: -120, size: 25, density: 1.2, priority: 1 },
    { name: 'NA_Central', centerLat: 40, centerLon: -95, size: 30, density: 1.0, priority: 1 },
    { name: 'NA_East', centerLat: 35, centerLon: -75, size: 20, density: 1.1, priority: 1 },
    { name: 'Canada', centerLat: 60, centerLon: -100, size: 35, density: 0.8, priority: 2 },
    { name: 'Mexico', centerLat: 25, centerLon: -100, size: 15, density: 0.9, priority: 2 },

    // South America
    { name: 'Brazil', centerLat: -15, centerLon: -55, size: 25, density: 1.0, priority: 1 },
    { name: 'Argentina', centerLat: -35, centerLon: -65, size: 20, density: 0.9, priority: 2 },
    { name: 'Andes', centerLat: -10, centerLon: -75, size: 30, density: 0.7, priority: 3 },

    // Europe
    { name: 'Western_Europe', centerLat: 50, centerLon: 5, size: 20, density: 1.3, priority: 1 },
    { name: 'Eastern_Europe', centerLat: 50, centerLon: 30, size: 25, density: 1.0, priority: 2 },
    { name: 'Scandinavia', centerLat: 65, centerLon: 15, size: 18, density: 0.8, priority: 2 },

    // Asia
    { name: 'China', centerLat: 35, centerLon: 105, size: 30, density: 1.4, priority: 1 },
    { name: 'India', centerLat: 20, centerLon: 78, size: 22, density: 1.3, priority: 1 },
    { name: 'Russia', centerLat: 60, centerLon: 100, size: 45, density: 0.6, priority: 2 },
    { name: 'Japan', centerLat: 35, centerLon: 135, size: 12, density: 1.2, priority: 1 },
    { name: 'Southeast_Asia', centerLat: 5, centerLon: 115, size: 25, density: 1.0, priority: 1 },

    // Africa
    { name: 'North_Africa', centerLat: 25, centerLon: 15, size: 30, density: 0.8, priority: 2 },
    { name: 'West_Africa', centerLat: 8, centerLon: -5, size: 20, density: 0.9, priority: 2 },
    { name: 'East_Africa', centerLat: 0, centerLon: 35, size: 25, density: 0.8, priority: 2 },
    { name: 'Southern_Africa', centerLat: -25, centerLon: 25, size: 18, density: 0.9, priority: 2 },

    // Oceania
    { name: 'Australia', centerLat: -25, centerLon: 135, size: 20, density: 0.8, priority: 2 },
    { name: 'New_Zealand', centerLat: -40, centerLon: 175, size: 8, density: 0.7, priority: 3 }
  ]

  static getInstance(): GeometryGenerator {
    if (!this.instance) {
      this.instance = new GeometryGenerator()
    }
    return this.instance
  }

  generateParticles(options: Partial<GenerationOptions> = {}): ParticleData[] {
    const opts: GenerationOptions = {
      pointCount: 1000,
      radius: 2.5,
      continentRegions: GeometryGenerator.DEFAULT_CONTINENTS,
      oceanDensity: 0.3,
      connectionPoints: 100,
      animationSpread: 2.0,
      qualityLevel: 1.0,
      ...options
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(opts)
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const particles = this.generateFibonacciSphere(opts)

    // Cache the result
    this.cacheResult(cacheKey, particles)

    return particles
  }

  private generateFibonacciSphere(options: GenerationOptions): ParticleData[] {
    const particles: ParticleData[] = []
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)) // Golden angle in radians

    // Generate base distribution
    for (let i = 0; i < options.pointCount; i++) {
      const normalizedIndex = i / (options.pointCount - 1)

      // Fibonacci sphere distribution
      const y = 1 - 2 * normalizedIndex
      const radiusAtY = Math.sqrt(1 - y * y)
      const theta = goldenAngle * i

      const x = Math.cos(theta) * radiusAtY
      const z = Math.sin(theta) * radiusAtY

      // Convert to lat/lon for continent checking
      const lat = Math.asin(y) * (180 / Math.PI)
      const lon = Math.atan2(z, x) * (180 / Math.PI)

      // Determine point category and properties
      const continentInfo = this.getContinentInfo(lat, lon, options.continentRegions)
      const isContinent = continentInfo.isInContinent

      // Skip some ocean points based on density settings
      if (!isContinent && Math.random() > options.oceanDensity) {
        continue
      }

      // Scale position by radius
      const position = new Vector3(
        x * options.radius,
        y * options.radius,
        z * options.radius
      )

      const particle: ParticleData = {
        id: `particle_${i}`,
        position: position.clone(),
        originalPosition: position.clone(),
        isContinent,
        animationDelay: Math.random() * options.animationSpread,
        size: this.calculateParticleSize(continentInfo, options.qualityLevel),
        category: this.determineCategory(continentInfo, lat, lon),
        metadata: {
          lat,
          lon,
          continentInfo,
          index: i,
          normalized: normalizedIndex
        }
      }

      particles.push(particle)
    }

    // Add connection points for data visualization
    this.addConnectionPoints(particles, options)

    // Sort by priority for rendering optimization
    particles.sort((a, b) => this.getParticlePriority(b) - this.getParticlePriority(a))

    return particles
  }

  private getContinentInfo(
    lat: number,
    lon: number,
    continents: ContinentRegion[]
  ): { isInContinent: boolean; continent?: ContinentRegion; distance: number; density: number } {
    let closestContinent: ContinentRegion | undefined
    let minDistance = Infinity
    let isInContinent = false

    for (const continent of continents) {
      const distance = this.calculateSphericalDistance(lat, lon, continent.centerLat, continent.centerLon)

      if (distance < continent.size) {
        isInContinent = true
        if (distance < minDistance) {
          minDistance = distance
          closestContinent = continent
        }
      }
    }

    return {
      isInContinent,
      continent: closestContinent,
      distance: minDistance,
      density: closestContinent?.density || 1.0
    }
  }

  private calculateSphericalDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 57.2958 // Approximate conversion to match sphere units
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private calculateParticleSize(
    continentInfo: { isInContinent: boolean; continent?: ContinentRegion; density: number },
    qualityLevel: number
  ): number {
    const baseSize = 0.03
    const continentMultiplier = continentInfo.isInContinent ? 1.5 : 1.0
    const densityMultiplier = Math.sqrt(continentInfo.density)
    const qualityMultiplier = 0.5 + (qualityLevel * 0.5)

    return baseSize * continentMultiplier * densityMultiplier * qualityMultiplier
  }

  private determineCategory(
    continentInfo: { isInContinent: boolean; continent?: ContinentRegion },
    lat: number,
    lon: number
  ): 'continent' | 'ocean' | 'connection' | 'data' {
    if (continentInfo.isInContinent) {
      return continentInfo.continent!.priority === 1 ? 'continent' : 'data'
    }

    // Major ocean highways and trade routes
    if (this.isOceanHighway(lat, lon)) {
      return 'connection'
    }

    return 'ocean'
  }

  private isOceanHighway(lat: number, lon: number): boolean {
    // Simplified ocean highway detection
    const highways = [
      { latRange: [40, 60], lonRange: [-60, -10] }, // North Atlantic
      { latRange: [-10, 10], lonRange: [-180, 180] }, // Equatorial routes
      { latRange: [-40, -20], lonRange: [20, 160] },  // Southern trade routes
    ]

    return highways.some(highway =>
      lat >= highway.latRange[0] && lat <= highway.latRange[1] &&
      ((lon >= highway.lonRange[0] && lon <= highway.lonRange[1]) ||
       (highway.lonRange[0] < 0 && highway.lonRange[1] > 0 &&
        (lon >= highway.lonRange[0] || lon <= highway.lonRange[1])))
    )
  }

  private addConnectionPoints(particles: ParticleData[], options: GenerationOptions): void {
    const continentParticles = particles.filter(p => p.isContinent)
    const connectionCount = Math.min(options.connectionPoints, continentParticles.length * 0.1)

    for (let i = 0; i < connectionCount; i++) {
      const source = continentParticles[Math.floor(Math.random() * continentParticles.length)]
      const target = continentParticles[Math.floor(Math.random() * continentParticles.length)]

      if (source === target) continue

      // Create intermediate connection points
      const steps = 3 + Math.floor(Math.random() * 3)
      for (let step = 1; step < steps; step++) {
        const t = step / steps
        const position = source.position.clone().lerp(target.position, t)

        // Add some curvature to make it look more natural
        const curvature = Math.sin(t * Math.PI) * 0.3
        position.normalize().multiplyScalar(options.radius + curvature)

        const connectionParticle: ParticleData = {
          id: `connection_${i}_${step}`,
          position,
          originalPosition: position.clone(),
          isContinent: false,
          animationDelay: Math.random() * options.animationSpread + t * 0.5,
          size: 0.02,
          category: 'connection',
          metadata: {
            sourceId: source.id,
            targetId: target.id,
            step,
            totalSteps: steps
          }
        }

        particles.push(connectionParticle)
      }
    }
  }

  private getParticlePriority(particle: ParticleData): number {
    const categoryPriority = {
      continent: 100,
      data: 80,
      connection: 60,
      ocean: 40
    }

    const basePriority = categoryPriority[particle.category]
    const sizePriority = particle.size * 50
    const continentBonus = particle.isContinent ? 20 : 0

    return basePriority + sizePriority + continentBonus
  }

  private generateCacheKey(options: GenerationOptions): string {
    return `${options.pointCount}_${options.radius}_${options.qualityLevel}_${options.oceanDensity}`
  }

  private cacheResult(key: string, particles: ParticleData[]): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, particles)
  }

  // Progressive loading support
  generateProgressiveLevels(maxPoints: number, levels: number = 4): ParticleData[][] {
    const levelSizes = []
    for (let i = 0; i < levels; i++) {
      const size = Math.floor(maxPoints * Math.pow(0.25 + (i / levels) * 0.75, 2))
      levelSizes.push(Math.max(100, size))
    }

    return levelSizes.map(size => this.generateParticles({ pointCount: size }))
  }

  // Utility methods
  clearCache(): void {
    this.cache.clear()
  }

  getCacheStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      keys: Array.from(this.cache.keys())
    }
  }

  // Static utility for creating custom continent configurations
  static createContinentRegion(
    name: string,
    lat: number,
    lon: number,
    size: number,
    options: Partial<Pick<ContinentRegion, 'density' | 'priority'>> = {}
  ): ContinentRegion {
    return {
      name,
      centerLat: lat,
      centerLon: lon,
      size,
      density: options.density || 1.0,
      priority: options.priority || 2
    }
  }
}