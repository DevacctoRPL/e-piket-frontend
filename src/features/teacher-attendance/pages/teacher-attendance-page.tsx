import { ContextHeader } from '@/components/context-header'
import { useFilters } from '@/components/filter-bar'
import { Page, PageHeader } from '@/components/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/auth-context'
import { todayISO } from '@/lib/date'
import { MyAttendanceCard } from '../components/my-attendance-card'
import { MyHistory } from '../components/my-history'
import { RecapPanel } from '../components/recap-panel'
import { ScheduledTeachers } from '../components/scheduled-teachers'

/**
 * Halaman Absensi Guru (PRD §6.4 FR-OUT-03, §6.5 FR-TCH-01..05, §7.3).
 * - Guru: kartu "Kehadiran Saya" (check-in/out) + riwayat pribadi.
 * - Piket/admin/pimpinan (teacher_attendance:read): guru terjadwal + rekap.
 */
export function TeacherAttendancePage() {
  const { user, can } = useAuth()
  const isTeacher = !!user?.teacherId && can('teacher_attendance:self')
  const canRead = can('teacher_attendance:read')
  const { values, set } = useFilters({ date: todayISO(), shift: '', tab: 'harian' })

  return (
    <Page>
      <PageHeader
        title="Absensi Guru"
        description={
          canRead
            ? 'Pantau kehadiran guru terjadwal, catat status guru yang berhalangan, dan lihat rekap kehadiran.'
            : 'Lakukan check-in saat datang dan check-out di akhir tugas. Riwayat kehadiran Anda tercatat otomatis.'
        }
      />

      {isTeacher && <MyAttendanceCard />}

      {canRead ? (
        <Tabs value={values.tab} onValueChange={(v) => set({ tab: v })} className="gap-4">
          <TabsList className="no-print">
            <TabsTrigger value="harian">Harian</TabsTrigger>
            <TabsTrigger value="rekap">Rekap</TabsTrigger>
            {isTeacher && <TabsTrigger value="saya">Riwayat saya</TabsTrigger>}
          </TabsList>
          <TabsContent value="harian" className="flex flex-col gap-4">
            <ContextHeader
              date={values.date}
              onDateChange={(d) => set({ date: d })}
              shiftCode={values.shift}
              onShiftChange={(s) => set({ shift: s })}
              allowAllShifts
            />
            <ScheduledTeachers date={values.date} shiftCode={values.shift} />
          </TabsContent>
          <TabsContent value="rekap">
            <RecapPanel />
          </TabsContent>
          {isTeacher && user.teacherId && (
            <TabsContent value="saya">
              <MyHistory teacherId={user.teacherId} />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        isTeacher && user.teacherId && <MyHistory teacherId={user.teacherId} />
      )}
    </Page>
  )
}
