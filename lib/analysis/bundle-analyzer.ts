// Bundle analysis and optimization utilities

export interface BundleMetrics {
  totalSize: number
  gzipSize: number
  chunks: ChunkInfo[]
  dependencies: DependencyInfo[]
  recommendations: string[]
}

export interface ChunkInfo {
  name: string
  size: number
  modules: string[]
  isAsync: boolean
  isEntry: boolean
}

export interface DependencyInfo {
  name: string
  size: number
  version: string
  duplicates?: string[]
  treeshakeable: boolean
}

export class BundleAnalyzer {
  private static readonly SIZE_THRESHOLDS = {
    CHUNK_WARNING: 250000, // 250KB
    CHUNK_ERROR: 500000,   // 500KB
    TOTAL_WARNING: 1000000, // 1MB
    TOTAL_ERROR: 2000000   // 2MB
  }

  // Analyze bundle from webpack stats
  static analyzeBundleStats(stats: any): BundleMetrics {
    const chunks: ChunkInfo[] = []
    const dependencies: DependencyInfo[] = []
    const recommendations: string[] = []

    let totalSize = 0

    // Analyze chunks
    if (stats.chunks) {
      for (const chunk of stats.chunks) {
        const chunkInfo: ChunkInfo = {
          name: chunk.names?.[0] || chunk.id,
          size: chunk.size || 0,
          modules: chunk.modules?.map((m: any) => m.name || m.identifier) || [],
          isAsync: !chunk.initial,
          isEntry: chunk.entry
        }

        chunks.push(chunkInfo)
        totalSize += chunkInfo.size

        // Generate recommendations for large chunks
        if (chunkInfo.size > this.SIZE_THRESHOLDS.CHUNK_WARNING) {
          recommendations.push(`Chunk "${chunkInfo.name}" is large (${Math.round(chunkInfo.size / 1024)}KB). Consider code splitting.`)
        }
      }
    }

    // Analyze dependencies
    if (stats.modules) {
      const dependencyMap = new Map<string, DependencyInfo>()

      for (const module of stats.modules) {
        const moduleName = this.extractPackageName(module.name || module.identifier)
        if (moduleName && moduleName.startsWith('node_modules/')) {
          const packageName = moduleName.split('/')[1]

          if (!dependencyMap.has(packageName)) {
            dependencyMap.set(packageName, {
              name: packageName,
              size: 0,
              version: 'unknown',
              treeshakeable: false
            })
          }

          const dep = dependencyMap.get(packageName)!
          dep.size += module.size || 0
        }
      }

      dependencies.push(...dependencyMap.values())
    }

    // Generate general recommendations
    if (totalSize > this.SIZE_THRESHOLDS.TOTAL_WARNING) {
      recommendations.push('Total bundle size is large. Consider implementing aggressive code splitting.')
    }

    // Check for duplicate dependencies
    const duplicates = this.findDuplicateDependencies(dependencies)
    if (duplicates.length > 0) {
      recommendations.push(`Found duplicate dependencies: ${duplicates.join(', ')}`)
    }

    // Check for heavy dependencies
    const heavyDeps = dependencies
      .filter(dep => dep.size > 100000) // 100KB
      .sort((a, b) => b.size - a.size)

    if (heavyDeps.length > 0) {
      recommendations.push(`Heavy dependencies found: ${heavyDeps.slice(0, 3).map(d => `${d.name} (${Math.round(d.size / 1024)}KB)`).join(', ')}`)
    }

    return {
      totalSize,
      gzipSize: Math.round(totalSize * 0.3), // Estimate
      chunks,
      dependencies,
      recommendations
    }
  }

  // Extract package name from module path
  private static extractPackageName(modulePath: string): string {
    if (!modulePath) return ''

    // Handle scoped packages
    const scopedMatch = modulePath.match(/node_modules\/(@[^\/]+\/[^\/]+)/)
    if (scopedMatch) return scopedMatch[1]

    // Handle regular packages
    const regularMatch = modulePath.match(/node_modules\/([^\/]+)/)
    if (regularMatch) return regularMatch[1]

    return modulePath
  }

  // Find duplicate dependencies
  private static findDuplicateDependencies(dependencies: DependencyInfo[]): string[] {
    const counts = new Map<string, number>()

    dependencies.forEach(dep => {
      counts.set(dep.name, (counts.get(dep.name) || 0) + 1)
    })

    return Array.from(counts.entries())
      .filter(([_, count]) => count > 1)
      .map(([name]) => name)
  }

  // Generate optimization recommendations
  static generateOptimizationReport(metrics: BundleMetrics): string {
    let report = '# Bundle Analysis Report\n\n'

    report += `## Overview\n`
    report += `- Total Size: ${Math.round(metrics.totalSize / 1024)}KB\n`
    report += `- Estimated Gzip Size: ${Math.round(metrics.gzipSize / 1024)}KB\n`
    report += `- Number of Chunks: ${metrics.chunks.length}\n`
    report += `- Dependencies: ${metrics.dependencies.length}\n\n`

    // Chunk analysis
    report += `## Largest Chunks\n`
    const largestChunks = metrics.chunks
      .sort((a, b) => b.size - a.size)
      .slice(0, 5)

    largestChunks.forEach(chunk => {
      report += `- ${chunk.name}: ${Math.round(chunk.size / 1024)}KB ${chunk.isAsync ? '(async)' : '(sync)'}\n`
    })

    // Dependency analysis
    report += `\n## Largest Dependencies\n`
    const largestDeps = metrics.dependencies
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)

    largestDeps.forEach(dep => {
      report += `- ${dep.name}: ${Math.round(dep.size / 1024)}KB\n`
    })

    // Recommendations
    if (metrics.recommendations.length > 0) {
      report += `\n## Recommendations\n`
      metrics.recommendations.forEach(rec => {
        report += `- ${rec}\n`
      })
    }

    return report
  }
}

// Runtime bundle monitoring
export class RuntimeBundleMonitor {
  private static loadedChunks = new Set<string>()
  private static chunkSizes = new Map<string, number>()

  static initialize(): void {
    if (typeof window === 'undefined') return

    // Monitor script loading
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()

      entries.forEach(entry => {
        if (entry.entryType === 'resource' && entry.name.includes('.js')) {
          const resourceEntry = entry as PerformanceResourceTiming
          const chunkName = this.extractChunkName(entry.name)

          if (chunkName && !this.loadedChunks.has(chunkName)) {
            this.loadedChunks.add(chunkName)
            this.chunkSizes.set(chunkName, resourceEntry.transferSize || 0)

            this.reportChunkLoaded(chunkName, resourceEntry.transferSize || 0)
          }
        }
      })
    })

    observer.observe({ entryTypes: ['resource'] })

    console.log('📦 Runtime bundle monitor initialized')
  }

  private static extractChunkName(url: string): string {
    const match = url.match(/\/([^\/]+)\.js$/)
    return match ? match[1] : ''
  }

  private static reportChunkLoaded(chunkName: string, size: number): void {
    // Report to analytics
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('chunk_loaded', {
        chunk_name: chunkName,
        size_bytes: size,
        size_kb: Math.round(size / 1024)
      })
    }

    // Log large chunks
    if (size > 100000) { // 100KB
      console.warn(`Large chunk loaded: ${chunkName} (${Math.round(size / 1024)}KB)`)
    }
  }

  static getLoadedChunks(): string[] {
    return Array.from(this.loadedChunks)
  }

  static getTotalLoadedSize(): number {
    return Array.from(this.chunkSizes.values()).reduce((sum, size) => sum + size, 0)
  }

  static generateReport(): any {
    return {
      loadedChunks: this.getLoadedChunks(),
      totalSize: this.getTotalLoadedSize(),
      chunkSizes: Object.fromEntries(this.chunkSizes)
    }
  }
}

// Performance budget checking
export class PerformanceBudgetChecker {
  private static budgets = {
    maxTotalSize: 500000, // 500KB
    maxChunkSize: 250000, // 250KB
    maxDependencies: 50,
    maxInitialChunks: 3
  }

  static checkBudget(metrics: BundleMetrics): { passed: boolean; violations: string[] } {
    const violations: string[] = []

    // Check total size
    if (metrics.totalSize > this.budgets.maxTotalSize) {
      violations.push(`Total bundle size (${Math.round(metrics.totalSize / 1024)}KB) exceeds budget (${Math.round(this.budgets.maxTotalSize / 1024)}KB)`)
    }

    // Check individual chunk sizes
    const largeChunks = metrics.chunks.filter(chunk => chunk.size > this.budgets.maxChunkSize)
    if (largeChunks.length > 0) {
      violations.push(`${largeChunks.length} chunk(s) exceed size budget: ${largeChunks.map(c => c.name).join(', ')}`)
    }

    // Check dependency count
    if (metrics.dependencies.length > this.budgets.maxDependencies) {
      violations.push(`Too many dependencies (${metrics.dependencies.length} > ${this.budgets.maxDependencies})`)
    }

    // Check initial chunks
    const initialChunks = metrics.chunks.filter(chunk => !chunk.isAsync)
    if (initialChunks.length > this.budgets.maxInitialChunks) {
      violations.push(`Too many initial chunks (${initialChunks.length} > ${this.budgets.maxInitialChunks})`)
    }

    return {
      passed: violations.length === 0,
      violations
    }
  }

  static setBudget(key: keyof typeof PerformanceBudgetChecker.budgets, value: number): void {
    this.budgets[key] = value
  }

  static getBudgets() {
    return { ...this.budgets }
  }
}

// Webpack plugin for bundle analysis
export class BundleAnalysisPlugin {
  apply(compiler: any) {
    compiler.hooks.done.tap('BundleAnalysisPlugin', (stats: any) => {
      const metrics = BundleAnalyzer.analyzeBundleStats(stats.toJson())
      const budgetCheck = PerformanceBudgetChecker.checkBudget(metrics)

      // Generate report
      const report = BundleAnalyzer.generateOptimizationReport(metrics)

      // Write to file
      const fs = require('fs')
      const path = require('path')

      fs.writeFileSync(
        path.join(process.cwd(), 'bundle-analysis.md'),
        report
      )

      // Log budget violations
      if (!budgetCheck.passed) {
        console.warn('🚨 Performance budget violations:')
        budgetCheck.violations.forEach(violation => {
          console.warn(`  - ${violation}`)
        })
      } else {
        console.log('✅ Performance budget check passed')
      }
    })
  }
}

// Tree shaking analysis
export class TreeShakingAnalyzer {
  static analyzeUnusedCode(webpackStats: any): string[] {
    const unusedExports: string[] = []

    if (webpackStats.modules) {
      webpackStats.modules.forEach((module: any) => {
        if (module.providedExports && module.usedExports) {
          const provided = new Set(module.providedExports)
          const used = new Set(module.usedExports)

          for (const exportName of provided) {
            if (!used.has(exportName)) {
              unusedExports.push(`${module.name}:${exportName}`)
            }
          }
        }
      })
    }

    return unusedExports
  }

  static generateTreeShakingReport(unusedExports: string[]): string {
    let report = '# Tree Shaking Analysis\n\n'

    if (unusedExports.length === 0) {
      report += '✅ No unused exports detected.\n'
    } else {
      report += `⚠️ Found ${unusedExports.length} unused exports:\n\n`
      unusedExports.forEach(exp => {
        report += `- ${exp}\n`
      })

      report += '\n## Recommendations\n'
      report += '- Remove unused exports to improve tree shaking\n'
      report += '- Use dynamic imports for large modules\n'
      report += '- Consider using barrel exports carefully\n'
    }

    return report
  }
}

// Export utilities for build scripts
export const bundleAnalysisUtils = {
  BundleAnalyzer,
  RuntimeBundleMonitor,
  PerformanceBudgetChecker,
  BundleAnalysisPlugin,
  TreeShakingAnalyzer
}