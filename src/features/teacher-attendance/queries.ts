import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard/queries'
import type { ID, ISODate } from '@/types/entities'
import { teacherAttendanceApi } from './api'
import type {
  AssignEmptySlotInput,
  CreateManualEmptySlotInput,
  UpdateManualEmptySlotInput,
  UpdateSubstitutionInput,
} from './types'

export const teacherAttendanceKeys = {
  all: ['teacher-attendance'] as const,
  scheduled: (date: ISODate) => [...teacherAttendanceKeys.all, 'scheduled', date] as const,
  emptySlots: (date: ISODate, search = '') => [...teacherAttendanceKeys.all, 'empty-slots', date, search] as const,
}

export function useScheduledTeachers(date: ISODate) {
  return useQuery({
    queryKey: teacherAttendanceKeys.scheduled(date),
    queryFn: ({ signal }) => teacherAttendanceApi.scheduled({ date }, signal),
    placeholderData: keepPreviousData,
  })
}

export function useEmptySlots(date: ISODate, search = '') {
  return useQuery({
    queryKey: teacherAttendanceKeys.emptySlots(date, search),
    queryFn: ({ signal }) => teacherAttendanceApi.emptySlots({ date, search }, signal),
    placeholderData: keepPreviousData,
  })
}

function useInvalidateEmptySlots() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: teacherAttendanceKeys.all })
    void qc.invalidateQueries({ queryKey: dashboardKeys.all })
  }
}

export function useCreateManualEmptySlot() {
  const invalidate = useInvalidateEmptySlots()
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CreateManualEmptySlotInput; idempotencyKey?: string }) =>
      teacherAttendanceApi.createManualSlot(body, idempotencyKey),
    onSuccess: invalidate,
  })
}

export function useUpdateManualEmptySlot() {
  const invalidate = useInvalidateEmptySlots()
  return useMutation({
    mutationFn: ({ id, body }: { id: ID; body: UpdateManualEmptySlotInput }) =>
      teacherAttendanceApi.updateManualSlot(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteManualEmptySlot() {
  const invalidate = useInvalidateEmptySlots()
  return useMutation({
    mutationFn: (id: ID) => teacherAttendanceApi.deleteManualSlot(id),
    onSuccess: invalidate,
  })
}

export function useAssignSubstitute() {
  const invalidate = useInvalidateEmptySlots()
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: AssignEmptySlotInput; idempotencyKey?: string }) =>
      teacherAttendanceApi.assignSubstitute(body, idempotencyKey),
    onSuccess: invalidate,
  })
}

export function useUpdateSubstitute() {
  const invalidate = useInvalidateEmptySlots()
  return useMutation({
    mutationFn: ({ id, body }: { id: ID; body: UpdateSubstitutionInput }) =>
      teacherAttendanceApi.updateSubstitute(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteSubstitute() {
  const invalidate = useInvalidateEmptySlots()
  return useMutation({
    mutationFn: (id: ID) => teacherAttendanceApi.deleteSubstitute(id),
    onSuccess: invalidate,
  })
}
