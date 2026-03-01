'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Send, CheckCircle2 } from 'lucide-react'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  rating: z.number().min(1).max(5).optional(),
  honeypot: z.string().max(0).optional(),
})

type FormData = z.infer<typeof schema>

function StarRating({ value, onChange }: { value: number; onChange: (_v: number) => void }) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-colors"
        >
          <Star
            size={20}
            className={
              star <= (hover || value)
                ? 'fill-[#0a0a0a] text-[#0a0a0a]'
                : 'text-[#e5e5e5]'
            }
          />
        </button>
      ))}
    </div>
  )
}

export default function FeedbackForm() {
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [rating, setRating] = useState(0)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    if (data.honeypot) return

    setServerError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, rating: rating || undefined }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Something went wrong')
      }

      setSubmitted(true)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to submit')
    }
  }

  return (
    <section id="feedback" className="relative bg-[#f9f9f9] py-24">
      <div className="mx-auto max-w-lg px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold text-[#0a0a0a] md:text-4xl">
            Share your feedback
          </h2>
          <p className="mt-4 text-sm text-[#555]">
            Help us make Aletheia better. We read every submission.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center"
            >
              <CheckCircle2 size={40} className="text-emerald-600" />
              <h3 className="text-lg font-semibold text-[#0a0a0a]">Thank you!</h3>
              <p className="text-sm text-[#555]">
                Your feedback has been received. We appreciate you taking the time.
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5 rounded-xl border border-[#e5e5e5] bg-white p-6"
            >
              {/* Honeypot — hidden from users */}
              <input
                {...register('honeypot')}
                tabIndex={-1}
                autoComplete="off"
                className="absolute left-0 top-0 h-0 w-0 opacity-0"
                aria-hidden="true"
              />

              <div>
                <label htmlFor="fb-name" className="mb-1.5 block text-xs font-medium text-[#555]">
                  Name
                </label>
                <input
                  id="fb-name"
                  {...register('name')}
                  className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3.5 py-2.5 text-sm text-[#0a0a0a] placeholder:text-[#999] outline-none transition-colors focus:border-[#0a0a0a]"
                  placeholder="Your name"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="fb-email" className="mb-1.5 block text-xs font-medium text-[#555]">
                  Email
                </label>
                <input
                  id="fb-email"
                  type="email"
                  {...register('email')}
                  className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3.5 py-2.5 text-sm text-[#0a0a0a] placeholder:text-[#999] outline-none transition-colors focus:border-[#0a0a0a]"
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#555]">
                  Rating
                </label>
                <StarRating value={rating} onChange={setRating} />
              </div>

              <div>
                <label htmlFor="fb-message" className="mb-1.5 block text-xs font-medium text-[#555]">
                  Message
                </label>
                <textarea
                  id="fb-message"
                  {...register('message')}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-[#e5e5e5] bg-white px-3.5 py-2.5 text-sm text-[#0a0a0a] placeholder:text-[#999] outline-none transition-colors focus:border-[#0a0a0a]"
                  placeholder="Tell us what you think..."
                />
                {errors.message && (
                  <p className="mt-1 text-xs text-red-500">{errors.message.message}</p>
                )}
              </div>

              {serverError && (
                <p className="text-sm text-red-500">{serverError}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0a0a0a] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                <Send size={16} />
                {isSubmitting ? 'Sending...' : 'Send Feedback'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
