import { useMutation, useQueryClient } from '@tanstack/react-query'
import { masterKeys } from '@/features/master-data/lookups'
import { settingsApi } from './api'

/** Root key fitur pengaturan (= masterKeys.settings()). */
export const settingsKeys = {
  all: ['settings'] as const,
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.update,
    onSuccess: (data) => {
      queryClient.setQueryData(masterKeys.settings(), data)
      // Pengaturan memengaruhi label status, aturan alasan, kop cetak, dsb. di semua fitur.
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      void queryClient.invalidateQueries({ queryKey: masterKeys.settings() })
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}
