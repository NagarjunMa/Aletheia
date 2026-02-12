# State Management System

## Overview

Ascendia uses a hybrid state management approach combining Zustand for client-side state and TanStack Query (React Query) for server state management. This provides optimal performance, caching, and developer experience.

## Architecture

### Client State (Zustand)
- **Lightweight & Fast**: Minimal boilerplate, excellent performance
- **TypeScript First**: Full type safety with great developer experience
- **Persistence**: Automatic localStorage persistence for user preferences
- **Devtools**: Redux DevTools integration for debugging

### Server State (TanStack Query)
- **Caching**: Intelligent caching with background updates
- **Synchronization**: Automatic data synchronization across components
- **Optimistic Updates**: Immediate UI updates with rollback on failure
- **Background Refetching**: Keep data fresh without user interaction

## Zustand Stores

### 1. Auth Store (`auth-store.ts`)
Manages user authentication and profile state.

```typescript
import { useAuth, useAuthActions, useUserProfile } from '@/lib/stores'

// Get auth state
const { user, profile, isLoading, isAuthenticated } = useAuth()

// Auth actions
const { setUser, signOut, updateProfile } = useAuthActions()

// User profile data
const profile = useUserProfile()
```

**Features:**
- User session management
- Profile data with CPL scores
- Automatic profile creation
- Persistent authentication state
- Auth state hydration

### 2. Streaming Store (`streaming-store.ts`)
Manages real-time streaming processing state.

```typescript
import {
  useStreamingActions,
  useActiveStreamingSession,
  useStreamingStatus
} from '@/lib/stores'

// Create and manage streaming sessions
const { createSession, updateSessionContent, completeSession } = useStreamingActions()

// Get active session
const session = useActiveStreamingSession()

// Overall streaming status
const { isStreaming, isConnected, sessionCount } = useStreamingStatus()
```

**Features:**
- Multi-session support (max 3 concurrent)
- Progress tracking with stages
- Real-time content updates
- Connection state management
- Session lifecycle management

### 3. Content Store (`content-store.ts`)
Manages conversations, inputs, and drafts state.

```typescript
import {
  useContentActions,
  useCurrentConversation,
  useConversationList,
  useContentStats
} from '@/lib/stores'

// Content management
const { setCurrentConversation, addDraft, updateInput } = useContentActions()

// Current context
const conversation = useCurrentConversation()

// Filtered and sorted conversations
const conversations = useConversationList()

// Analytics
const { totalConversations, averageCPL } = useContentStats()
```

**Features:**
- Hierarchical content structure
- Filtering and sorting
- Real-time updates
- Bulk operations
- Analytics and statistics

## TanStack Query Hooks

### Conversation Hooks (`use-conversations.ts`)

```typescript
import {
  useConversations,
  useConversation,
  useCreateConversation,
  useUpdateConversation
} from '@/lib/query/hooks'

// Fetch conversations with filters
const { data: conversations, isLoading } = useConversations({
  category: 'work',
  search: 'project'
})

// Single conversation
const { data: conversation } = useConversation(conversationId)

// Mutations
const createMutation = useCreateConversation()
const updateMutation = useUpdateConversation()
```

**Features:**
- Automatic caching and background updates
- Optimistic updates for better UX
- Prefetching for performance
- Error handling with retries

### CPL Hooks (`use-cpl.ts`)

```typescript
import {
  useAnalyzeCPL,
  useCPLTrends,
  useRealTimeCPLAnalysis,
  useAnalyzeCPLMutation
} from '@/lib/query/hooks'

// Real-time CPL analysis with debouncing
const { data: analysis, isAnalyzing } = useRealTimeCPLAnalysis(text, {
  detailedAnalysis: true
}, 2000)

// CPL trends over time
const { data: trends } = useCPLTrends('month')

// Manual analysis trigger
const analyzeMutation = useAnalyzeCPLMutation()
```

**Features:**
- Real-time analysis with smart debouncing
- Trend analysis and statistics
- Benchmark comparisons
- Suggestion generation
- Expensive operation caching

## Integration Patterns

### Provider Setup

```typescript
// app/layout.tsx
import { QueryProvider } from '@/components/providers/query-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
```

### Component Integration

```typescript
// components/ConversationList.tsx
import { useConversations, useContentActions } from '@/lib/stores'

function ConversationList() {
  // Server state (cached, auto-updated)
  const { data: conversations, isLoading } = useConversations()

  // Client state (immediate, local)
  const { setCurrentConversation } = useContentActions()

  const handleSelect = (conversation) => {
    // Update client state immediately
    setCurrentConversation(conversation.id)

    // Navigate or trigger other actions
    router.push(`/conversations/${conversation.id}`)
  }

  if (isLoading) return <ConversationListSkeleton />

  return (
    <div>
      {conversations?.map(conversation => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
}
```

### Real-time Streaming Integration

```typescript
// components/StreamingEditor.tsx
import { useStreamingActions, useActiveStreamingSession } from '@/lib/stores'
import { useAnalyzeCPLMutation } from '@/lib/query/hooks'

function StreamingEditor() {
  const { createSession, updateSessionContent } = useStreamingActions()
  const session = useActiveStreamingSession()
  const analyzeCPL = useAnalyzeCPLMutation()

  useEffect(() => {
    if (session?.status === 'completed') {
      // Trigger CPL analysis when streaming completes
      analyzeCPL.mutate({
        text: session.fullContent,
        detailedAnalysis: true
      })
    }
  }, [session?.status])

  // Component implementation...
}
```

## Best Practices

### 1. State Separation
- **Server State**: Use TanStack Query for data from APIs
- **Client State**: Use Zustand for UI state and user preferences
- **Component State**: Use React useState for local component state

### 2. Optimistic Updates
```typescript
const updateConversation = useUpdateConversation()

const handleTitleChange = async (newTitle: string) => {
  // Update UI immediately
  updateOptimistically(conversationId, { title: newTitle })

  try {
    await updateConversation.mutateAsync({
      conversationId,
      data: { title: newTitle }
    })
  } catch (error) {
    // Revert on error
    revertOptimisticUpdate(conversationId)
  }
}
```

### 3. Cache Management
```typescript
import { queryClient, queryKeys } from '@/lib/query/hooks'

// Invalidate specific data when needed
const handleConversationUpdate = () => {
  queryClient.invalidateQueries({
    queryKey: queryKeys.conversations.lists()
  })
}

// Prefetch data for better performance
const handleHover = (conversationId: string) => {
  queryClient.prefetchQuery({
    queryKey: queryKeys.conversations.detail(conversationId),
    queryFn: () => fetchConversation(conversationId)
  })
}
```

### 4. Error Handling
```typescript
// Queries
const { data, error, isError } = useConversations()

if (isError) {
  return <ErrorBoundary error={error} />
}

// Mutations
const mutation = useCreateConversation()

const handleCreate = async (data) => {
  try {
    await mutation.mutateAsync(data)
    toast.success('Conversation created!')
  } catch (error) {
    toast.error('Failed to create conversation')
  }
}
```

## Performance Optimizations

### 1. Query Key Normalization
All query keys are centralized in `queryKeys` object for consistency:

```typescript
// Good: Consistent keys
queryKeys.conversations.detail(id)
queryKeys.cpl.trends('month')

// Bad: Inconsistent keys
['conversation', id]
['cpl-trends', 'month']
```

### 2. Background Updates
Configure queries to update in background:

```typescript
const { data } = useConversations({}, {
  staleTime: 1000 * 60 * 5,     // 5 minutes
  refetchInterval: 1000 * 60,    // 1 minute background refresh
})
```

### 3. Selective Re-renders
Use selectors to prevent unnecessary re-renders:

```typescript
// Only re-render when user changes
const user = useAuthStore(state => state.user)

// Re-renders on any auth state change
const authState = useAuthStore()
```

## Development Tools

### Query Devtools
React Query Devtools are automatically enabled in development:
- View all cached queries
- Inspect query states
- Manually trigger refetches
- Monitor network requests

### Zustand Devtools
Enable Redux DevTools for Zustand stores:

```typescript
// In development, stores connect to Redux DevTools
const useAuthStore = create<AuthState>()(
  devtools(
    persist(/* store implementation */),
    { name: 'auth-store' }
  )
)
```

### Cache Debugging
Use development utilities:

```typescript
import { devtools } from '@/lib/query/client'

// Log all cached data
devtools.logCache()

// Get cache statistics
const stats = devtools.getCacheStats()

// Clear cache
devtools.clearCache()
```

## Migration Guide

### From Redux to Zustand
1. Replace actions with direct state updates
2. Remove action types and reducers
3. Use store selectors for performance
4. Migrate persistence to Zustand persist middleware

### From SWR to TanStack Query
1. Replace `useSWR` with `useQuery`
2. Update cache invalidation to use query keys
3. Convert mutations to use `useMutation`
4. Update error handling patterns

## Testing

### Testing Zustand Stores
```typescript
import { renderHook } from '@testing-library/react'
import { useAuthStore } from '@/lib/stores'

test('should sign out user', () => {
  const { result } = renderHook(() => useAuthStore())

  act(() => {
    result.current.setUser(mockUser)
  })

  expect(result.current.user).toBe(mockUser)

  act(() => {
    result.current.signOut()
  })

  expect(result.current.user).toBe(null)
})
```

### Testing React Query
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'

test('should fetch conversations', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })

  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  const { result } = renderHook(() => useConversations(), { wrapper })

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true)
  })
})
```