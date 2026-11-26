/**
 * Mock API Agenda Guru (Kegiatan Mengajar read-only dari API Presensi Guru termasuk TTD).
 *
 *   GET /teaching-logs -> daftar kegiatan mengajar per tanggal
 */
import { http, type HttpHandler } from 'msw'
import { todayISO } from '@/lib/date'
import { db, isDeleted } from '../db'
import {
  apiPath,
  errors,
  latency,
  matchesSearch,
  paginate,
  requireAuth,
  requirePermission,
  searchParams,
} from '../utils'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function liveLogs() {
  return db().teachingLogs.filter(
    (l) => !isDeleted('teachingLogs', l.id) && l.status !== 'CANCELLED' && l.status !== 'REJECTED',
  )
}

export const teachingLogsHandlers: HttpHandler[] = [
  http.get(apiPath('/teaching-logs'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'teaching_log:read')
    const sp = searchParams(request)
    const date = sp.get('date') || todayISO()
    if (!ISO_DATE.test(date)) return errors.validation({ date: 'invalid' })
    const classId = sp.get('classId')
    const q = sp.get('search')

    const items = liveLogs()
      .filter(
        (l) =>
          l.date === date &&
          (!classId || l.classId === classId) &&
          matchesSearch(q, l.teacherName, l.className, l.subjectName, l.topic),
      )
      .sort(
        (a, b) =>
          a.periodStart - b.periodStart ||
          a.className.localeCompare(b.className, 'id', { numeric: true }) ||
          a.teacherName.localeCompare(b.teacherName, 'id'),
      )
    return paginate(items, request, 10)
  }),
]
