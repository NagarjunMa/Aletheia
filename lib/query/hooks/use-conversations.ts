// Conversation React Query Hooks
// Created: December 8, 2024
// Purpose: React Query hooks for conversation management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, queryErrorHandler, mutationErrorHandler } from '../client'
import {
  getConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  archiveConversation,
  duplicateConversation,
  getConversationCategories,
} from '@/lib/actions'

// Types
interface ConversationFilters {
  category?: string
  search?: string
  limit?: number
  offset?: number
}

interface CreateConversationData {
  title: string
  description?: string
  category?: string
}

interface UpdateConversationData {
  title?: string
  description?: string
  category?: string
}

// Query hooks
export const useConversations = (filters?: ConversationFilters) => {
  return useQuery({
    queryKey: queryKeys.conversations.list(filters),
    queryFn: async () => {
      const formData = new FormData()
      if (filters?.category) formData.append('category', filters.category)
      if (filters?.search) formData.append('search', filters.search)
      if (filters?.limit) formData.append('limit', filters.limit.toString())
      if (filters?.offset) formData.append('offset', filters.offset.toString())

      const result = await getConversations(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

export const useConversation = (conversationId: string, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.conversations.detail(conversationId),
    queryFn: async () => {
      const formData = new FormData()
      formData.append('conversation_id', conversationId)

      const result = await getConversation(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled: enabled && !!conversationId,
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

export const useConversationCategories = () => {
  return useQuery({
    queryKey: ['conversation-categories'],
    queryFn: async () => {
      const result = await getConversationCategories()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    staleTime: 1000 * 60 * 15, // 15 minutes (categories don't change often)
    throwOnError: (error) => {
      queryErrorHandler(error as Error)
      return false
    },
  })
}

// Mutation hooks
export const useCreateConversation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateConversationData) => {
      const formData = new FormData()
      formData.append('title', data.title)
      if (data.description) formData.append('description', data.description)
      if (data.category) formData.append('category', data.category)

      const result = await createConversation(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: (data) => {
      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.lists(),
      })

      // Add new conversation to cache
      queryClient.setQueryData(
        queryKeys.conversations.detail(data.conversation.id),
        data.conversation
      )
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

export const useUpdateConversation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      conversationId,
      data,
    }: {
      conversationId: string
      data: UpdateConversationData
    }) => {
      const formData = new FormData()
      formData.append('conversation_id', conversationId)
      if (data.title) formData.append('title', data.title)
      if (data.description) formData.append('description', data.description)
      if (data.category) formData.append('category', data.category)

      const result = await updateConversation(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: (data, variables) => {
      // Update conversation in cache
      queryClient.setQueryData(
        queryKeys.conversations.detail(variables.conversationId),
        data.conversation
      )

      // Invalidate conversations list to refresh updated data
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.lists(),
      })
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

export const useDeleteConversation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const formData = new FormData()
      formData.append('conversation_id', conversationId)

      const result = await deleteConversation(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: (_, conversationId) => {
      // Remove conversation from cache
      queryClient.removeQueries({
        queryKey: queryKeys.conversations.detail(conversationId),
      })

      // Remove related inputs and drafts
      queryClient.removeQueries({
        queryKey: queryKeys.inputs.list(conversationId),
      })

      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.lists(),
      })
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

export const useArchiveConversation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const formData = new FormData()
      formData.append('conversation_id', conversationId)

      const result = await archiveConversation(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: (data, conversationId) => {
      // Update conversation in cache
      queryClient.setQueryData(
        queryKeys.conversations.detail(conversationId),
        data.conversation
      )

      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.lists(),
      })
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

export const useDuplicateConversation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const formData = new FormData()
      formData.append('conversation_id', conversationId)

      const result = await duplicateConversation(formData)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: (data) => {
      // Add duplicated conversation to cache
      queryClient.setQueryData(
        queryKeys.conversations.detail(data.conversation.id),
        data.conversation
      )

      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.lists(),
      })
    },
    onError: (error) => {
      mutationErrorHandler(error as Error)
    },
  })
}

// Optimistic update helpers
export const useConversationOptimisticUpdate = () => {
  const queryClient = useQueryClient()

  const updateOptimistically = (
    conversationId: string,
    updates: Partial<UpdateConversationData>
  ) => {
    queryClient.setQueryData(
      queryKeys.conversations.detail(conversationId),
      (oldData: any) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          ...updates,
          updated_at: new Date().toISOString(),
        }
      }
    )
  }

  const revertOptimisticUpdate = (conversationId: string) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.conversations.detail(conversationId),
    })
  }

  return {
    updateOptimistically,
    revertOptimisticUpdate,
  }
}

// Prefetching helpers
export const useConversationPrefetch = () => {
  const queryClient = useQueryClient()

  const prefetchConversation = (conversationId: string) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.conversations.detail(conversationId),
      queryFn: async () => {
        const formData = new FormData()
        formData.append('conversation_id', conversationId)

        const result = await getConversation(formData)
        if (!result.success) {
          throw new Error(result.error)
        }
        return result.data
      },
    })
  }

  const prefetchConversations = (filters?: ConversationFilters) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.conversations.list(filters),
      queryFn: async () => {
        const formData = new FormData()
        if (filters?.category) formData.append('category', filters.category)
        if (filters?.search) formData.append('search', filters.search)
        if (filters?.limit) formData.append('limit', filters.limit.toString())
        if (filters?.offset) formData.append('offset', filters.offset.toString())

        const result = await getConversations(formData)
        if (!result.success) {
          throw new Error(result.error)
        }
        return result.data
      },
    })
  }

  return {
    prefetchConversation,
    prefetchConversations,
  }
}