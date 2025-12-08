# Server Actions - Ascendia

## Overview

The Ascendia application uses Next.js 14 Server Actions with comprehensive Zod validation schemas for all data operations. This provides type-safe, validated server-side functionality with proper error handling and security.

## Architecture

### Core Components

1. **Validation Schemas** (`lib/validations/schemas.ts`)
   - Comprehensive Zod schemas for all data types
   - Type-safe validation with detailed error messages
   - Consistent validation across the application

2. **Server Actions** (`lib/actions/`)
   - Authentication actions (`auth.ts`)
   - Conversation management (`conversations.ts`)
   - User input and draft handling (`inputs.ts`)
   - Profile and analytics (`profile.ts`)
   - Utility functions (`utils.ts`)

3. **Type Safety**
   - Full TypeScript integration
   - Supabase database type generation
   - Exported types for client-side usage

## Features

### ✅ Authentication Actions
- User registration and login validation
- Password reset with secure token handling
- Google OAuth integration
- Session management and refresh

### ✅ Conversation Management
- Create, read, update, delete conversations
- Category management and filtering
- Search functionality with validation
- Archival and soft delete operations

### ✅ Input Processing
- User input creation with validation
- Bulk input operations
- Processing status tracking
- Draft generation coordination

### ✅ Profile Management
- User profile updates with validation
- Preferences management
- Dashboard statistics calculation
- User feedback collection

### ✅ Data Operations
- Export functionality with format validation
- Analytics event logging
- User activity summaries
- Account deletion with confirmation

## Validation Schemas

### User Profile Schemas
```typescript
// Profile update validation
const profileUpdateSchema = z.object({
  full_name: z.string().min(2).max(100),
  email: z.string().email(),
  avatar_url: z.string().url().optional().nullable(),
  preferences: z.record(z.any()).optional(),
})

// User preferences with defaults
const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  writing_style: z.enum(['formal', 'casual', 'academic', 'creative']).default('casual'),
  cpl_target: z.number().min(1).max(100).default(75),
  // ... more preferences
})
```

### Conversation Schemas
```typescript
// Conversation creation
const createConversationSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  initial_input: z.string().min(1).max(10000),
  context_notes: z.string().max(1000).optional(),
})

// Input processing with preferences
const userInputSchema = z.object({
  conversation_id: z.string().uuid(),
  input_text: z.string().min(1).max(10000),
  input_type: z.enum(['text', 'voice', 'file']).default('text'),
  processing_preferences: z.object({
    grammar_only: z.boolean().default(false),
    preserve_style: z.boolean().default(true),
    target_cpl: z.number().min(1).max(100).optional(),
    // ... more options
  }).optional(),
})
```

### AI Processing Schemas
```typescript
// Draft generation validation
const generateDraftSchema = z.object({
  input_id: z.string().uuid(),
  draft_type: z.enum(['grammar_fix', 'adaptive_polish']).default('adaptive_polish'),
  processing_options: z.object({
    preserve_tone: z.boolean().default(true),
    preserve_length: z.boolean().default(true),
    target_audience: z.string().max(100).optional(),
    style_guide: z.string().max(500).optional(),
  }).optional(),
})

// CPL analysis validation
const cplAnalysisSchema = z.object({
  text: z.string().min(1).max(10000),
  analysis_type: z.enum(['quick', 'detailed']).default('quick'),
  compare_to_user_baseline: z.boolean().default(true),
})
```

## Server Action Examples

### Creating a Conversation
```typescript
import { createConversation } from '@/lib/actions'

// In a form component
const handleSubmit = async (formData: FormData) => {
  const result = await createConversation(formData)

  if (result.success) {
    // Handle success
    console.log('Conversation created:', result.data)
  } else {
    // Handle error
    console.error('Error:', result.error)
  }
}
```

### Updating User Preferences
```typescript
import { updateUserPreferences } from '@/lib/actions'

// Update preferences with validation
const updatePreferences = async (preferences: UserPreferences) => {
  const formData = new FormData()
  formData.append('preferences', JSON.stringify(preferences))

  const result = await updateUserPreferences(formData)

  if (result.success) {
    // Preferences updated successfully
    revalidatePath('/settings')
  }
}
```

### Generating Drafts
```typescript
import { generateDraft } from '@/lib/actions'

// Generate a draft with options
const generateDraftFromInput = async (inputId: string, options: ProcessingOptions) => {
  const formData = new FormData()
  formData.append('input_id', inputId)
  formData.append('draft_type', 'adaptive_polish')
  formData.append('processing_options', JSON.stringify(options))

  const result = await generateDraft(formData)

  if (result.success) {
    // Draft generation started
    // The actual AI processing happens asynchronously
  }
}
```

## Security Features

### Input Validation
- All inputs validated with Zod schemas
- Comprehensive error messages
- Type-safe operations
- Protection against injection attacks

### Authentication & Authorization
- User ownership verification for all operations
- Row-Level Security (RLS) integration
- Session-based access control
- Protected server actions

### Data Sanitization
- Input sanitization utilities
- File upload validation
- Content length limits
- XSS protection measures

### Error Handling
- Consistent error response format
- Detailed logging for debugging
- User-friendly error messages
- Database error translation

## Performance Optimizations

### Efficient Queries
- Optimized database queries
- Proper indexing utilization
- Selective field retrieval
- Pagination support

### Caching & Revalidation
- Strategic path revalidation
- Cache invalidation on updates
- Optimistic updates where appropriate

### Rate Limiting
- Built-in rate limiting utilities
- Different limits for different operations
- Protection against abuse

## Usage Guidelines

### Form Integration
```typescript
// Use with React Hook Form
const { register, handleSubmit } = useForm()

const onSubmit = handleSubmit(async (data) => {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value as string)
  })

  const result = await createUserInput(formData)
  // Handle result
})
```

### Error Handling Best Practices
```typescript
// Consistent error handling
const handleAction = async () => {
  try {
    const result = await someAction(formData)

    if (result.success) {
      // Success: update UI, show success message
      toast.success(result.message)
      revalidatePath('/relevant-path')
    } else {
      // Validation or business logic error
      setError(result.error)
    }
  } catch (error) {
    // Unexpected error
    console.error('Unexpected error:', error)
    setError('An unexpected error occurred')
  }
}
```

### Type Safety
```typescript
// Import types from the actions module
import type { CreateConversation, UserPreferences } from '@/lib/actions'

// Use types in your components
interface ConversationFormProps {
  onSubmit: (data: CreateConversation) => Promise<void>
}
```

## Testing

### Validation Testing
```typescript
// Test validation schemas
import { createConversationSchema } from '@/lib/validations/schemas'

const testData = {
  title: 'Test Conversation',
  category: 'general',
  initial_input: 'Hello world',
}

const result = createConversationSchema.safeParse(testData)
expect(result.success).toBe(true)
```

### Server Action Testing
```typescript
// Mock server actions for testing
jest.mock('@/lib/actions', () => ({
  createConversation: jest.fn(),
  // ... other mocks
}))
```

## Monitoring & Analytics

### Performance Monitoring
- Action execution time tracking
- Error rate monitoring
- Usage pattern analysis

### Error Tracking
- Comprehensive error logging
- Integration with error tracking services
- User-friendly error reporting

### Usage Analytics
- Action usage statistics
- User behavior tracking
- Feature adoption metrics

## Migration & Updates

### Schema Evolution
- Backward-compatible schema updates
- Migration utilities for data transformation
- Version management for API changes

### Deployment Considerations
- Database migration coordination
- Feature flag integration
- Rollback procedures

---

**Status**: ✅ Complete and Production Ready

This Server Actions implementation provides a robust, type-safe, and secure foundation for all data operations in the Ascendia application, with comprehensive validation, error handling, and performance optimizations.