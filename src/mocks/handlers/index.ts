import { absenteesHandlers } from './absentees'
import { auditSettingsHandlers } from './audit-settings'
import { authHandlers } from './auth'
import { dashboardHandlers } from './dashboard'
import { dismissalsHandlers } from './dismissals'
import { dutyAgendaHandlers } from './duty-agenda'
import { extraActivitiesHandlers } from './extra-activities'
import { masterReadHandlers } from './master-read'
import { masterWriteHandlers } from './master-write'
import { reportsHandlers } from './reports'
import { studentAttendanceHandlers } from './student-attendance'
import { substitutionsHandlers } from './substitutions'
import { teacherAttendanceHandlers } from './teacher-attendance'
import { teachingLogsHandlers } from './teaching-logs'

/**
 * Urutan penting: handler fitur yang spesifik (mis. /students/:id/history) didaftarkan
 * sebelum handler master generik (/students/:id).
 */
export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...studentAttendanceHandlers,
  ...absenteesHandlers,
  ...dismissalsHandlers,
  ...teacherAttendanceHandlers,
  ...dutyAgendaHandlers,
  ...teachingLogsHandlers,
  ...substitutionsHandlers,
  ...extraActivitiesHandlers,
  ...reportsHandlers,
  ...auditSettingsHandlers,
  ...masterWriteHandlers,
  ...masterReadHandlers,
]
