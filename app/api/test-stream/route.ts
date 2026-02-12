import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return new Response(
      encoder.encode('data: {"type":"error","message":"Test endpoint only available in development"}\n\n'),
      {
        status: 403,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    )
  }

  try {
    const body = await request.json()
    const { prompt = "Hello, please help me write a short email." } = body

    console.log('🧪 Test Stream Starting...')
    console.log('Prompt:', prompt)

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial connection message
          controller.enqueue(
            encoder.encode(`data: {"type":"connected","message":"Stream connected successfully"}\n\n`)
          )

          // Test 1: Check Supabase connection
          console.log('Testing Supabase connection...')
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )

          // Try to query conversations table
          const { data: testData, error: testError } = await supabase
            .from('conversations')
            .select('id')
            .limit(1)

          if (testError) {
            console.error('Supabase test failed:', testError)
            controller.enqueue(
              encoder.encode(`data: {"type":"error","message":"Supabase connection failed: ${testError.message}"}\n\n`)
            )
          } else {
            console.log('✅ Supabase connected')
            controller.enqueue(
              encoder.encode(`data: {"type":"status","message":"Supabase connected successfully"}\n\n`)
            )
          }

          // Test 2: Check Anthropic API
          console.log('Testing Anthropic API...')
          controller.enqueue(
            encoder.encode(`data: {"type":"status","message":"Starting AI generation..."}\n\n`)
          )

          const models = [
            'claude-sonnet-4-5',          // Working model from your test
            'claude-3-5-sonnet-20241022', // Standard current model
            'claude-3-sonnet-20240229',   // Claude 3 Sonnet
            'claude-3-haiku-20240307',    // Fallback to Haiku
          ]

          let response: any = null
          let modelUsed = ''
          let apiError: any = null

          // Try different models until one works
          for (const model of models) {
            try {
              console.log(`🧪 Attempting with model: ${model}`)
              controller.enqueue(
                encoder.encode(`data: {"type":"debug","message":"Trying model: ${model}"}\n\n`)
              )

              // Test with a simple non-streaming call first to validate the model
              const testResponse = await anthropic.messages.create({
                model: model,
                max_tokens: 10,
                messages: [{
                  role: 'user',
                  content: 'Say "test"'
                }],
              })

              console.log(`✅ Model ${model} validation passed, creating stream...`)

              response = await anthropic.messages.stream({
                model: model,
                max_tokens: 500,
                messages: [{
                  role: 'user',
                  content: `Write a brief professional email about: ${prompt}. Keep it under 100 words.`
                }],
              })

              modelUsed = model
              console.log(`✅ Successfully initialized stream with model: ${model}`)
              break
            } catch (error) {
              console.log(`❌ Model ${model} failed:`, error)
              apiError = error
              const errorMsg = error instanceof Error ? error.message : String(error)
              controller.enqueue(
                encoder.encode(`data: {"type":"debug","message":"Model ${model} failed: ${errorMsg}"}\n\n`)
              )
              continue
            }
          }

          if (!response) {
            console.error('❌ All models failed. Last error:', apiError)
            controller.enqueue(
              encoder.encode(`data: {"type":"error","message":"All Claude models failed. Check API key and permissions."}\n\n`)
            )
            return
          }

          console.log(`🚀 Starting stream processing with model: ${modelUsed}`)
          controller.enqueue(
            encoder.encode(`data: {"type":"debug","message":"Stream processing started with: ${modelUsed}"}\n\n`)
          )

          let fullContent = ''
          let chunkCount = 0
          let totalChunks = 0

          for await (const chunk of response) {
            totalChunks++
            console.log(`📦 Chunk #${totalChunks}:`, JSON.stringify(chunk, null, 2))

            controller.enqueue(
              encoder.encode(`data: {"type":"debug","message":"Chunk ${totalChunks}: ${chunk.type}"}\n\n`)
            )

            if (chunk.type === 'content_block_delta') {
              console.log(`🔍 Content block delta details:`, JSON.stringify(chunk, null, 2))

              // Check delta structure
              if (chunk.delta && chunk.delta.type === 'text_delta' && chunk.delta.text) {
                fullContent += chunk.delta.text
                chunkCount++

                console.log(`📝 Text chunk #${chunkCount}: "${chunk.delta.text}"`)

                // Send chunk with progress
                const progress = Math.min((fullContent.length / 200) * 100, 95)
                const chunkData = {
                  type: "content",
                  text: chunk.delta.text,
                  progress: progress,
                  chunkNumber: chunkCount
                }

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`)
                )
              } else {
                console.log(`⚠️ Unexpected delta structure:`, chunk.delta)
                controller.enqueue(
                  encoder.encode(`data: {"type":"debug","message":"Unexpected delta: ${JSON.stringify(chunk.delta)}"}\n\n`)
                )
              }
            } else if (chunk.type === 'content_block_start') {
              console.log('🎬 Content block started:', chunk)
              controller.enqueue(
                encoder.encode(`data: {"type":"debug","message":"Content block started"}\n\n`)
              )
            } else if (chunk.type === 'content_block_stop') {
              console.log('🛑 Content block stopped:', chunk)
              controller.enqueue(
                encoder.encode(`data: {"type":"debug","message":"Content block stopped"}\n\n`)
              )
            } else if (chunk.type === 'message_start') {
              console.log('💬 Message started:', chunk)
            } else if (chunk.type === 'message_stop') {
              console.log('✋ Message stopped:', chunk)
            } else {
              console.log(`❓ Unknown chunk type: ${chunk.type}`, chunk)
            }
          }

          console.log(`📊 Stream Summary:`)
          console.log(`  - Model used: ${modelUsed}`)
          console.log(`  - Total chunks received: ${totalChunks}`)
          console.log(`  - Text chunks processed: ${chunkCount}`)
          console.log(`  - Final content length: ${fullContent.length}`)
          console.log(`  - Final content: "${fullContent}"`)

          // Send completion
          controller.enqueue(
            encoder.encode(`data: {"type":"complete","totalChunks":${chunkCount},"totalLength":${fullContent.length}}\n\n`)
          )

          console.log(`✅ Stream completed. Sent ${chunkCount} chunks, ${fullContent.length} characters`)

        } catch (error) {
          console.error('Test stream error:', error)
          controller.enqueue(
            encoder.encode(`data: {"type":"error","message":"${error instanceof Error ? error.message : 'Unknown error'}"}\n\n`)
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    })

  } catch (error) {
    console.error('Test endpoint error:', error)
    return new Response(
      encoder.encode(`data: {"type":"error","message":"Failed to start test stream"}\n\n`),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    )
  }
}