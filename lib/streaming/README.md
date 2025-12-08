# Streaming Implementation - Real-time AI Processing

## Overview

The Ascendia streaming system provides real-time AI processing capabilities using Server-Sent Events (SSE) and ReadableStream APIs. This enables users to see their content being processed in real-time, providing immediate feedback and a responsive user experience.

## Architecture

### Core Components

1. **Server-Side Streaming** (`lib/streaming/server.ts`)
   - Session management and coordination
   - ReadableStream creation and handling
   - Rate limiting and resource management
   - Session cleanup and health monitoring

2. **Client-Side Utilities** (`lib/streaming/client.ts`)
   - StreamingClient class for consuming streams
   - React hooks for easy integration
   - Error handling and reconnection logic
   - Progress tracking and UI utilities

3. **API Route Handler** (`app/api/stream/process/route.ts`)
   - HTTP endpoint for streaming requests
   - Authentication and validation
   - Session creation and management

4. **Server Actions** (`lib/actions/streaming.ts`)
   - Server-side session management
   - Integration with existing action system
   - Form-based streaming controls

## Features

### ✅ Real-time Processing
- Live content generation with immediate feedback
- Progress tracking with percentage and stage indicators
- Status updates throughout the processing pipeline
- Completion notifications with final results

### ✅ Session Management
- Secure session creation and validation
- Rate limiting (max 3 concurrent sessions per user)
- Session persistence and cleanup
- Health monitoring and diagnostics

### ✅ Error Handling & Recovery
- Automatic reconnection on connection loss
- Graceful degradation for network issues
- User-friendly error messages
- Retry mechanisms with exponential backoff

### ✅ Performance Optimization
- Efficient memory usage with streaming
- Resource cleanup and session expiration
- Rate limiting to prevent abuse
- Connection pooling and management

## Usage Examples

### Server-Side Session Creation
```typescript
import { createStreamingSession, streamProcessing } from '@/lib/streaming/server'

// Create a new streaming session
const result = await createStreamingSession(inputId, 'adaptive_polish')

if (result.success) {
  // Create and return streaming response
  const stream = await streamProcessing(result.sessionId!)
  return createSSEResponse(stream)
}
```

### Client-Side Streaming Consumption
```typescript
import { StreamingClient } from '@/lib/streaming/client'

// Create streaming client with callbacks
const client = new StreamingClient({
  onStatus: (status) => setStatus(status),
  onContent: (content, fullContent) => {
    setCurrentContent(content)
    setFullContent(fullContent)
  },
  onProgress: (progress, stage) => {
    setProgress(progress)
    setStage(stage)
  },
  onCompleted: (result) => {
    setResult(result)
    setIsComplete(true)
  },
  onError: (error) => setError(error)
})

// Start streaming
const success = await client.startStreaming(inputId, 'adaptive_polish', {
  targetCpl: 75,
  preserveTone: true
})
```

### React Hook Integration
```typescript
import { useStreaming } from '@/lib/streaming/client'

function ProcessingComponent({ inputId }: { inputId: string }) {
  const [status, setStatus] = useState('')
  const [content, setContent] = useState('')
  const [progress, setProgress] = useState(0)

  const { startStreaming, stopStreaming, isStreaming, isConnected } = useStreaming({
    onStatus: setStatus,
    onContent: (chunk, full) => setContent(full),
    onProgress: (prog) => setProgress(prog),
    onCompleted: (result) => {
      console.log('Processing completed:', result)
    },
    onError: (error) => {
      console.error('Streaming error:', error)
    }
  })

  const handleStart = () => {
    startStreaming(inputId, 'adaptive_polish', { targetCpl: 80 })
  }

  return (
    <div>
      <button onClick={handleStart} disabled={isStreaming}>
        {isStreaming ? 'Processing...' : 'Start Processing'}
      </button>

      {isStreaming && (
        <div>
          <div>Status: {status}</div>
          <div>Progress: {progress}%</div>
          <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
          <div>Content: {content}</div>
        </div>
      )}
    </div>
  )
}
```

### Server Actions Integration
```typescript
import { startStreamingProcessing } from '@/lib/actions/streaming'

// Start streaming via server action
async function handleStreamingForm(formData: FormData) {
  const result = await startStreamingProcessing(formData)

  if (result.success) {
    // Redirect to streaming page with session ID
    redirect(`/stream/${result.data.sessionId}`)
  }
}
```

## Message Types

### Status Messages
```typescript
{
  type: 'status',
  data: {
    status: string,      // Human-readable status
    sessionId: string,   // Session identifier
    draftId?: string     // Draft ID when available
  }
}
```

### Content Messages
```typescript
{
  type: 'content',
  data: {
    content: string,     // New content chunk
    fullContent: string, // Complete content so far
    draftId: string      // Associated draft ID
  }
}
```

### Progress Messages
```typescript
{
  type: 'progress',
  data: {
    progress: number,    // Percentage (0-100)
    stage: string,       // Current processing stage
    draftId: string      // Associated draft ID
  }
}
```

### Completion Messages
```typescript
{
  type: 'completed',
  data: {
    draftId: string,     // Final draft ID
    content: string,     // Complete processed content
    cplScore: number,    // Content Polish Level score
    finalStats: {
      wordCount: number,
      characterCount: number,
      processingTime: number
    }
  }
}
```

### Error Messages
```typescript
{
  type: 'error',
  data: {
    error: string,       // Error message
    draftId?: string,    // Draft ID if available
    sessionId: string    // Session identifier
  }
}
```

## API Endpoints

### POST /api/stream/process
Start a new streaming processing session.

**Request:**
```json
{
  "inputId": "uuid",
  "draftType": "grammar_fix" | "adaptive_polish",
  "options": {
    "targetCpl": 75,
    "preserveTone": true,
    "preserveLength": true
  }
}
```

**Response:**
- Success: SSE stream with real-time updates
- Error: JSON error response

### GET /api/stream/process?sessionId=uuid
Get the status of an existing streaming session.

**Response:**
```json
{
  "sessionId": "uuid",
  "status": "active" | "completed" | "failed",
  "inputId": "uuid",
  "draftType": "adaptive_polish",
  "createdAt": "2024-12-07T...",
  "lastActivity": "2024-12-07T..."
}
```

## Session Management

### Session Lifecycle
1. **Creation**: Session created when streaming starts
2. **Active**: Processing in progress with real-time updates
3. **Completed**: Processing finished successfully
4. **Failed**: Processing failed or was cancelled
5. **Cleanup**: Session removed after timeout

### Rate Limiting
- Maximum 3 concurrent sessions per user
- Automatic session cleanup after 30 minutes of inactivity
- Global session monitoring and health checks

### Session Storage
```typescript
interface StreamingSession {
  id: string              // Unique session identifier
  userId: string          // Owner user ID
  inputId: string         // Input being processed
  draftType: string       // Type of processing
  status: string          // Current status
  createdAt: Date         // Creation timestamp
  lastActivity: Date      // Last activity timestamp
}
```

## Error Handling

### Connection Errors
- Automatic reconnection with exponential backoff
- Maximum 3 reconnection attempts
- Graceful fallback to non-streaming processing

### Processing Errors
- Detailed error messages with recovery suggestions
- Proper cleanup of failed sessions
- User notification of processing failures

### Network Issues
- Connection state monitoring
- Timeout handling
- Bandwidth-adaptive streaming

## Performance Considerations

### Memory Management
- Streaming prevents large content buffering
- Automatic session cleanup
- Resource usage monitoring

### Scalability
- Session-based architecture for horizontal scaling
- Rate limiting for resource protection
- Health monitoring for service reliability

### Optimization
- Efficient message encoding
- Minimal overhead for status updates
- Optimized content chunking

## Testing

### Unit Tests
```typescript
import { createStreamingSession, streamProcessing } from '@/lib/streaming/server'

describe('Streaming Server', () => {
  test('creates valid streaming session', async () => {
    const result = await createStreamingSession('input-id', 'adaptive_polish')
    expect(result.success).toBe(true)
    expect(result.sessionId).toBeDefined()
  })
})
```

### Integration Tests
```typescript
import { StreamingClient } from '@/lib/streaming/client'

describe('Streaming Client', () => {
  test('handles streaming responses correctly', async () => {
    const client = new StreamingClient({
      onContent: jest.fn(),
      onCompleted: jest.fn()
    })

    // Mock streaming test
    await client.startStreaming('input-id', 'grammar_fix')
  })
})
```

### Load Testing
- Concurrent session stress testing
- Memory usage profiling
- Connection stability testing

## Deployment Considerations

### Production Setup
1. **Load Balancing**: Ensure session affinity for streaming connections
2. **Monitoring**: Set up connection and session monitoring
3. **Scaling**: Configure horizontal scaling for high load
4. **Cleanup**: Implement scheduled session cleanup

### Environment Variables
```env
# Streaming configuration
STREAMING_MAX_CONCURRENT_PER_USER=3
STREAMING_SESSION_TIMEOUT_MS=1800000
STREAMING_CLEANUP_INTERVAL_MS=300000
STREAMING_MAX_RECONNECT_ATTEMPTS=3
```

### Health Monitoring
- Active session count tracking
- Connection success/failure rates
- Average processing times
- Resource usage metrics

---

**Status**: ✅ Production Ready

The streaming implementation provides a robust, scalable foundation for real-time AI processing with comprehensive error handling, session management, and performance optimization.