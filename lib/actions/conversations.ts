'use server'

import { createClient, getUser } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  createConversationSchema,
  updateConversationSchema,
  searchSchema,
  type CreateConversation,
  type UpdateConversation,
  type Search
} from '@/lib/validations/schemas'
import type { Database } from '@/lib/database/types'

type Conversation = Database['public']['Tables']['conversations']['Row']
type ConversationInsert = Database['public']['Tables']['conversations']['Insert']

// Create a new conversation
export async function createConversation(formData: FormData) {
  try {
    // Get authenticated user
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Parse and validate form data
    const rawData = {
      title: formData.get('title') as string,
      category: formData.get('category') as string,
      initial_input: formData.get('initial_input') as string,
      context_notes: formData.get('context_notes') as string || undefined,
    }

    const validatedData = createConversationSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { title, category, initial_input, context_notes } = validatedData.data
    const supabase = createClient()

    // Create the conversation
    const conversationData: ConversationInsert = {
      user_id: user.id,
      title,
      category,
      status: 'active',
      context_notes: context_notes || null,
      metadata: {
        created_from: 'web_app',
        initial_input_preview: initial_input.substring(0, 100),
      },
    }

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert(conversationData)
      .select()
      .single()

    if (convError) {
      console.error('Conversation creation error:', convError)
      return {
        success: false,
        error: 'Failed to create conversation',
      }
    }

    // Create the initial user input
    const { error: inputError } = await supabase
      .from('user_inputs')
      .insert({
        conversation_id: conversation.id,
        user_id: user.id,
        input_text: initial_input,
        input_type: 'text',
        processing_status: 'pending',
        metadata: {
          is_initial_input: true,
        },
      })

    if (inputError) {
      console.error('Initial input creation error:', inputError)
      // Clean up the conversation if input creation fails
      await supabase
        .from('conversations')
        .delete()
        .eq('id', conversation.id)

      return {
        success: false,
        error: 'Failed to create initial input',
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/conversations')

    return {
      success: true,
      data: conversation,
      message: 'Conversation created successfully',
    }
  } catch (error) {
    console.error('Create conversation error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Update an existing conversation
export async function updateConversation(formData: FormData) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Parse and validate form data
    const rawData = {
      id: formData.get('id') as string,
      title: formData.get('title') as string || undefined,
      category: formData.get('category') as string || undefined,
      status: formData.get('status') as 'active' | 'archived' | 'deleted' || undefined,
      context_notes: formData.get('context_notes') as string || undefined,
    }

    const validatedData = updateConversationSchema.safeParse(rawData)
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0].message,
      }
    }

    const { id, ...updates } = validatedData.data
    const supabase = createClient()

    // Check ownership
    const { data: existingConv, error: checkError } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', id)
      .single()

    if (checkError || existingConv?.user_id !== user.id) {
      return {
        success: false,
        error: 'Conversation not found or access denied',
      }
    }

    // Update the conversation
    const { data, error } = await supabase
      .from('conversations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Conversation update error:', error)
      return {
        success: false,
        error: 'Failed to update conversation',
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/conversations')
    revalidatePath(`/conversations/${id}`)

    return {
      success: true,
      data,
      message: 'Conversation updated successfully',
    }
  } catch (error) {
    console.error('Update conversation error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get user's conversations with optional search and filtering
export async function getConversations(searchParams?: URLSearchParams) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        data: [],
      }
    }

    const supabase = createClient()
    let query = supabase
      .from('conversations')
      .select(`
        *,
        user_inputs(count),
        generated_drafts(count)
      `)
      .eq('user_id', user.id)
      .neq('status', 'deleted')

    // Apply search and filters if provided
    if (searchParams) {
      const searchQuery = searchParams.get('query')
      const category = searchParams.get('category')
      const status = searchParams.get('status')
      const sortBy = searchParams.get('sortBy') || 'updated_at'
      const sortDir = searchParams.get('sortDir') || 'desc'

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`)
      }

      if (category) {
        query = query.eq('category', category)
      }

      if (status) {
        query = query.eq('status', status)
      }

      // Apply sorting
      query = query.order(sortBy as any, { ascending: sortDir === 'asc' })
    } else {
      // Default sort by updated_at desc
      query = query.order('updated_at', { ascending: false })
    }

    const { data, error } = await query

    if (error) {
      console.error('Get conversations error:', error)
      return {
        success: false,
        error: 'Failed to fetch conversations',
        data: [],
      }
    }

    return {
      success: true,
      data: data || [],
    }
  } catch (error) {
    console.error('Get conversations error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: [],
    }
  }
}

// Get a single conversation by ID
export async function getConversation(conversationId: string) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        data: null,
      }
    }

    const supabase = createClient()

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        user_inputs(*),
        generated_drafts(*)
      `)
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Get conversation error:', error)
      return {
        success: false,
        error: 'Conversation not found',
        data: null,
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error('Get conversation error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: null,
    }
  }
}

// Archive a conversation
export async function archiveConversation(conversationId: string) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const supabase = createClient()

    const { error } = await supabase
      .from('conversations')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Archive conversation error:', error)
      return {
        success: false,
        error: 'Failed to archive conversation',
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/conversations')

    return {
      success: true,
      message: 'Conversation archived successfully',
    }
  } catch (error) {
    console.error('Archive conversation error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Delete a conversation (soft delete)
export async function deleteConversation(conversationId: string) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const supabase = createClient()

    const { error } = await supabase
      .from('conversations')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Delete conversation error:', error)
      return {
        success: false,
        error: 'Failed to delete conversation',
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/conversations')

    return {
      success: true,
      message: 'Conversation deleted successfully',
    }
  } catch (error) {
    console.error('Delete conversation error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

// Get conversation categories for the user
export async function getConversationCategories() {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        data: [],
      }
    }

    const supabase = createClient()

    const { data, error } = await supabase
      .from('conversations')
      .select('category')
      .eq('user_id', user.id)
      .neq('status', 'deleted')

    if (error) {
      console.error('Get categories error:', error)
      return {
        success: false,
        error: 'Failed to fetch categories',
        data: [],
      }
    }

    // Get unique categories
    const categories = Array.from(new Set(data?.map(item => item.category) || []))
      .filter(Boolean)
      .sort()

    return {
      success: true,
      data: categories,
    }
  } catch (error) {
    console.error('Get categories error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
      data: [],
    }
  }
}

// Duplicate a conversation
export async function duplicateConversation(conversationId: string) {
  try {
    const user = await getUser()
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    const supabase = createClient()

    // Get the original conversation
    const { data: originalConv, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !originalConv) {
      return {
        success: false,
        error: 'Conversation not found',
      }
    }

    // Create the duplicate
    const { data: newConv, error: createError } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: `${originalConv.title} (Copy)`,
        category: originalConv.category,
        status: 'active',
        context_notes: originalConv.context_notes,
        metadata: {
          ...originalConv.metadata,
          duplicated_from: conversationId,
          created_from: 'duplication',
        },
      })
      .select()
      .single()

    if (createError) {
      console.error('Duplicate conversation error:', createError)
      return {
        success: false,
        error: 'Failed to duplicate conversation',
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/conversations')

    return {
      success: true,
      data: newConv,
      message: 'Conversation duplicated successfully',
    }
  } catch (error) {
    console.error('Duplicate conversation error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}