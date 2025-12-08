import { http, HttpResponse } from 'msw'

// Mock response data
const mockUser = {
  id: 'test-user-id',
  email: 'test@ascendia.dev',
  full_name: 'Test User',
  avatar_url: null,
  cpl_score: 75.5,
  preferences: {},
  created_at: '2024-01-01T00:00:00Z'
}

const mockConversations = [
  {
    id: 'conv-1',
    user_id: 'test-user-id',
    title: 'Email Draft',
    category: 'email',
    context: {},
    is_archived: false,
    created_at: '2024-01-01T00:00:00Z',
    last_activity_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'conv-2',
    user_id: 'test-user-id',
    title: 'Business Proposal',
    category: 'proposal',
    context: {},
    is_archived: false,
    created_at: '2024-01-02T00:00:00Z',
    last_activity_at: '2024-01-02T00:00:00Z'
  }
]

const mockDrafts = [
  {
    id: 'draft-1',
    user_input_id: 'input-1',
    conversation_id: 'conv-1',
    user_id: 'test-user-id',
    content: 'This is a polished version of your email draft.',
    draft_type: 'adaptive_polish',
    cpl_score: 82.3,
    is_accepted: false,
    created_at: '2024-01-01T00:00:00Z'
  }
]

export const handlers = [
  // Supabase Auth
  http.post('http://localhost:54321/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: mockUser
    })
  }),

  http.get('http://localhost:54321/auth/v1/user', () => {
    return HttpResponse.json({
      aud: 'authenticated',
      exp: Date.now() / 1000 + 3600,
      sub: mockUser.id,
      email: mockUser.email,
      phone: '',
      app_metadata: {},
      user_metadata: {},
      role: 'authenticated',
      aal: 'aal1',
      amr: [{ method: 'password', timestamp: Date.now() }],
      session_id: 'mock-session-id'
    })
  }),

  // Supabase Database - Profiles
  http.get('http://localhost:54321/rest/v1/profiles', ({ request }) => {
    const url = new URL(request.url)
    const userId = url.searchParams.get('id')

    if (userId) {
      return HttpResponse.json([mockUser])
    }
    return HttpResponse.json([mockUser])
  }),

  http.post('http://localhost:54321/rest/v1/profiles', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ ...mockUser, ...body })
  }),

  http.patch('http://localhost:54321/rest/v1/profiles', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ ...mockUser, ...body })
  }),

  // Supabase Database - Conversations
  http.get('http://localhost:54321/rest/v1/conversations', ({ request }) => {
    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')

    if (userId === 'test-user-id') {
      return HttpResponse.json(mockConversations)
    }
    return HttpResponse.json([])
  }),

  http.post('http://localhost:54321/rest/v1/conversations', async ({ request }) => {
    const body = await request.json() as any
    const newConversation = {
      id: `conv-${Date.now()}`,
      user_id: body.user_id || 'test-user-id',
      title: body.title || 'New Conversation',
      category: body.category || 'general',
      context: body.context || {},
      is_archived: false,
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString()
    }
    return HttpResponse.json(newConversation)
  }),

  // Supabase Database - Generated Drafts
  http.get('http://localhost:54321/rest/v1/generated_drafts', ({ request }) => {
    const url = new URL(request.url)
    const conversationId = url.searchParams.get('conversation_id')

    if (conversationId) {
      return HttpResponse.json(mockDrafts.filter(d => d.conversation_id === conversationId))
    }
    return HttpResponse.json(mockDrafts)
  }),

  http.post('http://localhost:54321/rest/v1/generated_drafts', async ({ request }) => {
    const body = await request.json() as any
    const newDraft = {
      id: `draft-${Date.now()}`,
      user_input_id: body.user_input_id || `input-${Date.now()}`,
      conversation_id: body.conversation_id || 'conv-1',
      user_id: body.user_id || 'test-user-id',
      content: body.content || 'Mock generated content',
      draft_type: body.draft_type || 'adaptive_polish',
      cpl_score: body.cpl_score || 75.0,
      is_accepted: body.is_accepted || false,
      created_at: new Date().toISOString()
    }
    return HttpResponse.json(newDraft)
  }),

  // Anthropic API Mock
  http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
    const body = await request.json() as any
    const messages = body.messages || []
    const userMessage = messages.find((m: any) => m.role === 'user')?.content || ''

    // Mock response based on input
    const mockResponse = {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'text',
        text: `[DRAFT 1: Grammar Fix Only]\n${userMessage.replace(/[.!?]$/, '')}.\n\n[DRAFT 2: Adaptive Polish]\n${userMessage.charAt(0).toUpperCase()}${userMessage.slice(1).replace(/[.!?]$/, '')} with enhanced clarity and professional tone.`
      }],
      model: body.model || 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 50,
        output_tokens: 100
      }
    }

    return HttpResponse.json(mockResponse)
  }),

  // AI SDK Streaming endpoint
  http.post('http://localhost:3000/api/chat/stream', async ({ request }) => {
    const body = await request.json() as any
    const input = body.prompt || body.input || ''

    // Mock streaming response
    const chunks = [
      'This is a ',
      'streaming ',
      'response ',
      'for testing ',
      'purposes. ',
      'The content ',
      'appears ',
      'gradually.'
    ]

    // Return a mock streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        chunks.forEach((chunk, index) => {
          setTimeout(() => {
            controller.enqueue(encoder.encode(`data: {"text":"${chunk}"}\n\n`))
            if (index === chunks.length - 1) {
              controller.close()
            }
          }, index * 100)
        })
      }
    })

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  }),

  // Health check endpoint
  http.get('http://localhost:3000/api/health', () => {
    return HttpResponse.json({ status: 'ok', timestamp: Date.now() })
  }),

  // Fallback for unhandled requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`)
    return new HttpResponse(null, { status: 404 })
  })
]