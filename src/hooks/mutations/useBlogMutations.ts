import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  approvePost,
  createPost,
  deletePost,
  rejectPost,
  submitStudentPost,
  togglePublish,
  updatePost,
  type BlogPostSavePayload,
  type StudentBlogPostSubmission,
} from '../../api/blog'
import { queryKeys } from '../../lib/queryKeys'
import type { BlogPost } from '../../lib/database.types'

function invalidateBlogQueries(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.blogPosts.all })
  if (id) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.blogPosts.detail(id) })
  }
}

export function useSubmitStudentPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (submission: StudentBlogPostSubmission) => submitStudentPost(submission),
    onSuccess: () => invalidateBlogQueries(queryClient),
  })
}

export function useApproveBlogPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => approvePost(id),
    onSuccess: (_data, id) => invalidateBlogQueries(queryClient, id),
  })
}

export function useRejectBlogPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => rejectPost(id),
    onSuccess: (_data, id) => invalidateBlogQueries(queryClient, id),
  })
}

export function useToggleBlogPublish() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (post: BlogPost) => togglePublish(post),
    onSuccess: (_status, post) => invalidateBlogQueries(queryClient, post.id),
  })
}

export function useDeleteBlogPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => invalidateBlogQueries(queryClient),
  })
}

interface SaveBlogPostInput {
  id?: string
  payload: BlogPostSavePayload & { created_at?: string }
}

export function useSaveBlogPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: SaveBlogPostInput) => {
      if (id) {
        return updatePost(id, payload)
      }
      return createPost({ ...payload, created_at: payload.created_at! })
    },
    onSuccess: (_data, { id }) => invalidateBlogQueries(queryClient, id),
  })
}
