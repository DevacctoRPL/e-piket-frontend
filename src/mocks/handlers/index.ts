import { absenteesHandlers } from './absentees'
import { authHandlers } from './auth'
import { dashboardHandlers } from './dashboard'
import { extraActivitiesHandlers } from './extra-activities'
import { masterReadHandlers } from './master-read'
import { substitutionsHandlers } from './substitutions'
import { teacherAttendanceHandlers } from './teacher-attendance'
import { teachingLogsHandlers } from './teaching-logs'

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...absenteesHandlers,
  ...teacherAttendanceHandlers,
  ...substitutionsHandlers,
  ...teachingLogsHandlers,
  ...extraActivitiesHandlers,
  ...masterReadHandlers,
]
