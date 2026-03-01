'use client'

import { motion } from 'framer-motion'

export default function Demo() {
  return (
    <section className="relative bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl font-bold text-[#0a0a0a] md:text-4xl">
            Generic templates vs. messages that actually land
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Before — Generic */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-6"
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-500">
                Generic Template
              </span>
            </div>
            <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
              <p className="text-sm leading-relaxed text-[#555] italic">
                &ldquo;Hi, I came across your impressive profile and I&apos;m really passionate
                about connecting with like-minded professionals. I&apos;d love to leverage
                synergies and explore potential collaborations. Let&apos;s connect!&rdquo;
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-red-500 line-through">
                &ldquo;impressive profile&rdquo;
              </span>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-red-500 line-through">
                &ldquo;passionate about&rdquo;
              </span>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-red-500 line-through">
                &ldquo;leverage synergies&rdquo;
              </span>
            </div>
          </motion.div>

          {/* After — Aletheia */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="rounded-xl border border-[#0a0a0a]/10 bg-white p-6"
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                Aletheia Output
              </span>
            </div>
            <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
              <p className="text-sm leading-relaxed text-[#0a0a0a]">
                &ldquo;Hi Sarah — your talk at React Conf on server components caught my
                attention. I&apos;m a frontend engineer at Vercel working on similar
                hydration problems. Would love to hear how your team at Netflix handles
                streaming SSR at scale. Happy to share our approach too.&rdquo;
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-600">
                Profile-specific
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-600">
                Resume-grounded
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-600">
                No clichés
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
