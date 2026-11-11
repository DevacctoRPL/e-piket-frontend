import { http } from 'msw'
import { todayISO } from '@/lib/date'
import { db, isDeleted } from '../db'
import {
  apiError,
  apiPath,
  errors,
  latency,
  ok,
  requireAuth,
  requirePermission,
  searchParams,
} from '../utils'
import { computeDashboardSummary } from './dashboard-summary'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Handler mock untuk fitur dashboard (FR-RPT-01). */
export const dashboardHandlers = [
  http.get(apiPath('/dashboard/summary'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'dashboard:read')
    const sp = searchParams(request)
    const date = sp.get('date') || todayISO()
    const shiftCode = sp.get('shiftCode') || null

    const details: Record<string, string> = {}
    if (!ISO_DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      details.date = 'Format tanggal harus YYYY-MM-DD.'
    }
    if (shiftCode && !db().shifts.some((s) => s.code === shiftCode && !isDeleted('shifts', s.id))) {
      details.shiftCode = 'Shift tidak dikenal.'
    }
    if (Object.keys(details).length) throw errors.validation(details, 'Parameter dashboard tidak valid.')

    try {
      return ok(computeDashboardSummary(user, { date, shiftCode }))
    } catch (err) {
      // Tanpa ini MSW mengubah exception menjadi 500 polos tanpa jejak — cetak penyebab aslinya di console.
      console.error('[mock] /dashboard/summary gagal dihitung:', err)
      return apiError(500, 'INTERNAL_ERROR', 'Ringkasan dashboard gagal dihitung. Coba muat ulang halaman.')
    }
  }),
]
