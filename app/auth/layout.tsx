'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#0a0a0a]">
      {/* Left: form area */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        {children}
      </div>

      {/* Right: branding showcase (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0c1220] via-[#111827] to-[#0f172a] items-center justify-center">
        {/* Subtle blue glow */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-indigo-500/8 rounded-full blur-[96px]" />

        {/* Diagonal accent lines */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-[600px] h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent rotate-[35deg]" />
          <div className="absolute top-1/3 -left-20 w-[500px] h-px bg-gradient-to-r from-transparent via-blue-500/10 to-transparent rotate-[35deg]" />
          <div className="absolute bottom-1/4 -right-10 w-[400px] h-px bg-gradient-to-r from-transparent via-indigo-500/15 to-transparent rotate-[35deg]" />
        </div>

        {/* Large "A" watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[28rem] font-bold text-white/[0.03] leading-none tracking-tighter">
            A
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-md px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <Image
                src="/Aletheia.svg"
                alt="Aletheia"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="text-white/80 text-sm font-medium tracking-wide uppercase">Aletheia</span>
            </div>
          </motion.div>

          <motion.h2
            className="text-4xl font-bold text-white mb-4 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            Welcome to{' '}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Aletheia
            </span>
          </motion.h2>

          <motion.p
            className="text-[hsl(var(--muted-foreground))] text-base leading-relaxed mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            AI-powered networking assistant that helps you craft personalized LinkedIn messages and build meaningful professional connections.
          </motion.p>

          <motion.div
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <p className="text-sm text-white/70 mb-4">
              More than <span className="text-white font-semibold">1,000+</span> professionals joined
            </p>
            <div className="flex items-center">
              {/* Avatar stack */}
              <div className="flex -space-x-2.5">
                {['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500'].map((color, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full ${color} border-2 border-[#111827] flex items-center justify-center text-[10px] font-semibold text-white`}
                  >
                    {['J', 'A', 'K', 'M'][i]}
                  </div>
                ))}
                <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-[#111827] flex items-center justify-center text-[10px] font-medium text-white/60">
                  +9k
                </div>
              </div>
              <div className="ml-4 flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
