/**
 * Mock API Jam Tambahan (read-only dari API Presensi Guru termasuk multi-kelas & TTD).
 *
 *   GET /extra-activities -> daftar jam tambahan per tanggal
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

const COLLECTION = 'extraActivities'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function liveActivities() {
  return db().extraActivities.filter((a) => !isDeleted(COLLECTION, a.id))
}

export const extraActivitiesHandlers: HttpHandler[] = [
  http.get(apiPath('/extra-activities'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'extra_activity:read')
    const sp = searchParams(request)
    const date = sp.get('date') || todayISO()
    if (!DATE_RE.test(date)) return errors.validation({ date: 'invalid' })
    const classId = sp.get('classId')
    const q = sp.get('search')

    const items = liveActivities()
      .filter(
        (a) =>
          a.date === date &&
          (!classId || a.classIds.includes(classId)) &&
          matchesSearch(q, a.name, a.instructorName, a.topic, a.classNames.join(' ')),
      )
      .sort(
        (a, b) =>
          a.instructorName.localeCompare(b.instructorName, 'id') ||
          a.name.localeCompare(b.name, 'id'),
      )
    return paginate(items, request, 10)
  }),
]
