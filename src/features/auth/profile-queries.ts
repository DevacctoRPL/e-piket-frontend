import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, authKeys } from './api'

/** PATCH /auth/me — ubah nama/email sendiri (FR-AUTH-04). */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; email: string | null }) => authApi.updateMe(body).then((r) => r.data),
    onSuccess: (me) => {
      queryClient.setQueryData(authKeys.me, me)
      void queryClient.invalidateQueries({ queryKey: authKeys.me })
    },
  })
}
