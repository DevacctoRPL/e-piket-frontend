import { api } from '@/lib/api-client'
import type { DataResponse, ListResponse } from '@/types/api'
import type {
  ID,
  ISODate,
  ShiftCode,
  SubstituteCandidate,
  SubstitutionRecord,
  SubstitutionSlot,
  SubstitutionSummary,
} from '@/types/entities'

export interface SlotListParams {
  date: ISODate
  shiftCode?: ShiftCode
  classId?: ID
  status?: SubstitutionSlot['status']
}

export interface SummaryParams {
  date?: ISODate
  dateFrom?: ISODate
  dateTo?: ISODate
  shiftCode?: ShiftCode
  classId?: ID
}

export interface RecordListParams {
  dateFrom?: ISODate
  dateTo?: ISODate
  classId?: ID
  teacherId?: ID
  status?: SubstitutionRecord['status']
  page?: number
  pageSize?: number
}

/** Rentang periode yang akan ditangani — konflik dihitung untuk rentang ini. */
export interface CandidateRange {
  periodStart?: number
  periodEnd?: number
}

export interface CreateSubstitutionBody {
  date: ISODate
  timetableSlotId: ID
  substituteTeacherId: ID
  periodStart?: number
  periodEnd?: number
  periodCount?: number
  activity?: string | null
  note?: string | null
  overrideConflict?: boolean
  overrideReason?: string | null
}

export interface UpdateSubstitutionBody {
  activity?: string | null
  note?: string | null
  periodCount?: number
}

const clean = <T extends object>(p: T) => p as Record<string, string | number | undefined>

/** Layanan API jam kosong / guru pengganti (PRD §10.6). Komponen tidak memanggil api.* langsung. */
export const substitutionsApi = {
  slots: (params: SlotListParams, signal?: AbortSignal) =>
    api
      .get<DataResponse<SubstitutionSlot[]>>('/substitution-slots', clean(params), { signal })
      .then((r) => r.data),

  summary: (params: SummaryParams, signal?: AbortSignal) =>
    api
      .get<DataResponse<SubstitutionSummary>>('/substitution-slots/summary', clean(params), { signal })
      .then((r) => r.data),

  candidates: (slotId: ID, range: CandidateRange, signal?: AbortSignal) =>
    api
      .get<DataResponse<SubstituteCandidate[]>>(
        `/substitution-slots/${encodeURIComponent(slotId)}/candidates`,
        clean(range),
        { signal },
      )
      .then((r) => r.data),

  records: (params: RecordListParams, signal?: AbortSignal) =>
    api.get<ListResponse<SubstitutionRecord>>('/substitution-records', clean(params), { signal }),

  create: (body: CreateSubstitutionBody, idempotencyKey: string) =>
    api
      .post<DataResponse<SubstitutionRecord>>('/substitution-records', body, { idempotencyKey })
      .then((r) => r.data),

  update: (id: ID, body: UpdateSubstitutionBody) =>
    api
      .patch<DataResponse<SubstitutionRecord>>(`/substitution-records/${encodeURIComponent(id)}`, body)
      .then((r) => r.data),

  cancel: (id: ID, reason: string) =>
    api
      .post<DataResponse<SubstitutionRecord>>(
        `/substitution-records/${encodeURIComponent(id)}/cancel`,
        { reason },
      )
      .then((r) => r.data),
}
