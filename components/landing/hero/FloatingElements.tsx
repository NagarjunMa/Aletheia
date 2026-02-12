'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Text, Html } from '@react-three/drei'
import { useRef, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import * as THREE from 'three'

// Floating UI Card Component
function FloatingCard({ position, text, delay }: {
  position: [number, number, number],
  text: string,
  delay: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime + delay) * 0.1
      meshRef.current.rotation.y = Math.cos(state.clock.elapsedTime + delay) * 0.1
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + delay) * 0.2
    }
  })

  return (
    <Float
      speed={1.5}
      rotationIntensity={0.5}
      floatIntensity={0.5}
    >
      <mesh
        ref={meshRef}
        position={position}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.1 : 1}
      >
        <boxGeometry args={[2, 1.2, 0.1]} />
        <meshStandardMaterial
          color="#2e5797"
          transparent
          opacity={0.8}
          metalness={0.6}
          roughness={0.4}
        />

        <Html
          transform
          occlude
          position={[0, 0, 0.06]}
        >
          <div className="bg-card/90 backdrop-blur-sm border border-[#2e5797]/20 rounded-lg p-3 text-xs text-center whitespace-nowrap pointer-events-none">
            {text}
          </div>
        </Html>
      </mesh>
    </Float>
  )
}

// Floating Particles
function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null)

  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(100 * 3)
    for (let i = 0; i < 100; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10
    }
    return positions
  }, [])

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.05
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array

      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(state.clock.elapsedTime + positions[i]) * 0.01
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={100}
          array={particlesPosition}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#2e5797"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  )
}

// 3D Text Element
function FloatingText() {
  const textRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (textRef.current) {
      textRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3
      textRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.5
    }
  })

  return (
    <Float
      speed={2}
      rotationIntensity={0.3}
      floatIntensity={0.8}
    >
      <Text
        ref={textRef}
        position={[0, 2, -5]}
        fontSize={0.8}
        color="#4a7bc8"
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-bold.woff"
      >
        AI Writing
      </Text>
    </Float>
  )
}

// Main Floating Elements Component
export default function FloatingElements() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{
          position: [0, 0, 10],
          fov: 45,
        }}
        style={{ background: 'transparent' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 5, 5]}
          intensity={0.6}
          color="#ffffff"
        />
        <pointLight
          position={[-5, -5, 5]}
          intensity={0.4}
          color="#2e5797"
        />

        {/* 3D Text */}
        <FloatingText />

        {/* Floating UI Cards */}
        <FloatingCard
          position={[-4, 1, -2]}
          text="Grammar Check ✓"
          delay={0}
        />
        <FloatingCard
          position={[4, -1, -1]}
          text="Style Enhancement ✨"
          delay={1}
        />
        <FloatingCard
          position={[-3, -2, -3]}
          text="Voice Learning 🧠"
          delay={2}
        />
        <FloatingCard
          position={[5, 2, -2]}
          text="Real-time Polish 🚀"
          delay={3}
        />

        {/* Floating Particles */}
        <FloatingParticles />

        {/* Additional geometric shapes */}
        <Float
          speed={1}
          rotationIntensity={0.8}
          floatIntensity={1}
        >
          <mesh position={[6, 3, -4]}>
            <icosahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial
              color="#1a3d6b"
              transparent
              opacity={0.7}
              wireframe
            />
          </mesh>
        </Float>

        <Float
          speed={1.5}
          rotationIntensity={0.6}
          floatIntensity={0.8}
        >
          <mesh position={[-6, -3, -3]}>
            <octahedronGeometry args={[0.4, 0]} />
            <meshStandardMaterial
              color="#4a7bc8"
              transparent
              opacity={0.6}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        </Float>

        <Float
          speed={2}
          rotationIntensity={0.4}
          floatIntensity={1.2}
        >
          <mesh position={[0, -4, -5]}>
            <torusGeometry args={[0.5, 0.2, 8, 16]} />
            <meshStandardMaterial
              color="#2e5797"
              transparent
              opacity={0.5}
              wireframe
            />
          </mesh>
        </Float>
      </Canvas>

      {/* CSS-based floating elements for fallback */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-1/4 left-1/4 w-4 h-4 border border-[#2e5797]/30 rounded-full"
        />

        <motion.div
          animate={{
            x: [0, -30, 0],
            y: [0, 50, 0],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-3/4 right-1/4 w-3 h-3 bg-[#4a7bc8]/20 rounded-full blur-sm"
        />

        <motion.div
          animate={{
            x: [0, 40, 0],
            y: [0, -40, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/2 right-1/3 w-2 h-8 bg-gradient-to-t from-[#2e5797]/20 to-transparent rounded-full"
        />
      </div>
    </div>
  )
}