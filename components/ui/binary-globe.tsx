'use client'

import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface DataPointProps {
  position: [number, number, number]
  isContinent: boolean
  delay: number
}

function DataPoint({ position, isContinent, delay }: DataPointProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!)

  useFrame((state) => {
    if (meshRef.current && materialRef.current) {
      // Pulsing effect for data points
      const pulse = Math.sin(state.clock.elapsedTime * 2 + delay) * 0.2 + 0.8
      materialRef.current.opacity = pulse

      // Subtle scale effect
      const scale = pulse * 0.9 + 0.1
      meshRef.current.scale.setScalar(scale)
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[isContinent ? 0.08 : 0.03, 8, 6]} />
      <meshBasicMaterial
        ref={materialRef}
        color={isContinent ? "#2e5797" : "#4a7bc8"}
        transparent
        opacity={isContinent ? 1.0 : 0.6}
      />
    </mesh>
  )
}

interface BinaryGlobeSceneProps {
  radius?: number
  pointCount?: number
}

function BinaryGlobeScene({ radius = 4, pointCount = 50 }: BinaryGlobeSceneProps) {
  const groupRef = useRef<THREE.Group>(null!)

  // Define continent-like regions with better coverage
  const continentRegions = useMemo(() => [
    // North America
    { centerLat: 45, centerLon: -100, size: 35 },
    { centerLat: 60, centerLon: -95, size: 25 }, // Alaska/Canada
    { centerLat: 25, centerLon: -80, size: 20 }, // Eastern US

    // Europe & Asia
    { centerLat: 55, centerLon: 15, size: 30 }, // Northern Europe
    { centerLat: 40, centerLon: 35, size: 25 }, // Mediterranean
    { centerLat: 50, centerLon: 80, size: 45 }, // Central Asia
    { centerLat: 30, centerLon: 110, size: 35 }, // East Asia
    { centerLat: 20, centerLon: 78, size: 25 }, // India

    // Africa
    { centerLat: 10, centerLon: 20, size: 30 }, // Central Africa
    { centerLat: -20, centerLon: 25, size: 25 }, // Southern Africa
    { centerLat: 30, centerLon: 5, size: 20 }, // North Africa

    // South America
    { centerLat: -10, centerLon: -60, size: 25 },
    { centerLat: -25, centerLon: -55, size: 20 },

    // Australia & Oceania
    { centerLat: -25, centerLon: 135, size: 18 },
  ], [])

  // Check if a point is in a continent region
  const isInContinent = (lat: number, lon: number) => {
    return continentRegions.some(region => {
      const latDiff = Math.abs(lat - region.centerLat)
      const lonDiff = Math.abs(lon - region.centerLon)
      const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff)
      return distance < region.size
    })
  }

  // Generate points on sphere surface using Fibonacci sphere algorithm
  const points = useMemo(() => {
    const points: Array<{
      position: [number, number, number]
      isContinent: boolean
      delay: number
    }> = []

    const goldenAngle = Math.PI * (3 - Math.sqrt(5)) // Golden angle in radians

    for (let i = 0; i < pointCount; i++) {
      // Y coordinate
      const y = 1 - (i / (pointCount - 1)) * 2

      // Radius at y
      const radiusAtY = Math.sqrt(1 - y * y)

      // Angle
      const theta = goldenAngle * i

      // X and Z coordinates
      const x = Math.cos(theta) * radiusAtY
      const z = Math.sin(theta) * radiusAtY

      // Convert to lat/lon for continent checking
      const lat = Math.asin(y) * (180 / Math.PI)
      const lon = Math.atan2(z, x) * (180 / Math.PI)

      // Check if this point is in a continent
      const inContinent = isInContinent(lat, lon)

      // Scale by radius
      const position: [number, number, number] = [
        x * radius,
        y * radius,
        z * radius
      ]

      // Random delay for animation
      const delay = Math.random() * Math.PI * 2

      // Add more density for visual effect
      if (inContinent || Math.random() > 0.6) {
        points.push({ position, isContinent: inContinent, delay })
      }
    }

    return points
  }, [radius, pointCount, continentRegions])

  useFrame((state) => {
    if (groupRef.current) {
      // Smooth Earth-like rotation
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.1
      // Slight wobble for dynamic effect
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.05
    }
  })

  return (
    <group ref={groupRef}>
      {points.map((point, index) => (
        <DataPoint
          key={index}
          position={point.position}
          isContinent={point.isContinent}
          delay={point.delay}
        />
      ))}
    </group>
  )
}

function CameraController() {
  const { camera } = useThree()

  useFrame((state) => {
    // Gentle camera movement for dynamic effect
    camera.position.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.5
    camera.position.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.3 + 0.5
    camera.lookAt(0, 0, 0)
  })

  return null
}

interface BinaryGlobeProps {
  className?: string
  radius?: number
  pointCount?: number
  showFallback?: boolean
}

function BinaryGlobeFallback() {
  return (
    <div className="flex items-center justify-center w-full h-full bg-ascendia-black">
      <div className="relative w-64 h-64">
        <div className="absolute inset-0 rounded-full border-2 border-ascendia-accent animate-spin"></div>
        <div className="absolute inset-4 rounded-full border border-ascendia-accent/50 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '3s' }}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-ascendia-accent font-mono text-lg animate-binary-pulse">
            01010101<br/>
            10101010<br/>
            01010101<br/>
            10101010
          </div>
        </div>
      </div>
    </div>
  )
}

export function BinaryGlobe({ className, radius = 2.5, pointCount = 50, showFallback = false }: BinaryGlobeProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Check for WebGL support
  const hasWebGLSupport = useMemo(() => {
    if (!isMounted) return false
    try {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      return !!context
    } catch (e) {
      return false
    }
  }, [isMounted])

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (!isMounted) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [isMounted])

  // Show fallback during SSR or when conditions aren't met
  if (!isMounted || showFallback || !hasWebGLSupport || prefersReducedMotion) {
    return <BinaryGlobeFallback />
  }

  return (
    <div className={className} style={{ width: '100%', height: '500px' }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0) // Transparent background
        }}
      >
        <CameraController />
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1.2} color="#2e5797" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4a7bc8" />
        <BinaryGlobeScene radius={radius} pointCount={pointCount} />
      </Canvas>
    </div>
  )
}