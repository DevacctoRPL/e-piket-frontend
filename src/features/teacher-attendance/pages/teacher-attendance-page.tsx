import { useQueryClient } from '@tanstack/react-query'
import { DatePickerPill } from '@/components/date-picker-pill'
import { useFilters } from '@/components/filter-bar'
import { Page, PageHeader } from '@/components/page'
import { todayISO } from '@/lib/date'
import { EmptySlotsCard } from '../components/empty-slots-card'
import { TeacherPresenceCard } from '../components/teacher-presence-card'
import { teacherAttendanceKeys } from '../queries'

/**
 * Panel Absensi Guru (Excalidraw Layar 1 + revisi Jam Kosong):
 * - Kolom kiri: Kehadiran Guru (otomatis & read-only dari Presensi Guru + Sinkron Presensi)
 * - Kolom kanan: Jam Kosong (Pencarian + tombol "+ Tambah", tabel Kelas & Jam | Guru Tidak Hadir | Guru Piket | Aksi)
 */
export function TeacherAttendancePage() {
  const today = todayISO()
  const { values, set } = useFilters({ date: today })
  const date = values.date
  const qc = useQueryClient()

  const syncAll = async () => {
    await qc.refetchQueries({ queryKey: teacherAttendanceKeys.all, type: 'active' })
  }

  return (
    <Page className="gap-5">
      <PageHeader
        title="Absensi Guru"
        description="Pantau kehadiran guru dari Presensi Guru (Read-only) dan kelola penugasan guru piket pada kelas jam kosong."
        actions={
          <DatePickerPill
            id="teacher-att-date"
            date={date}
            maxDate={today}
            onChange={(next) => set({ date: next })}
          />
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start">
        <div className="min-w-0 xl:col-span-5">
          <TeacherPresenceCard date={date} onSyncAll={syncAll} />
        </div>
        <div className="min-w-0 xl:col-span-7">
          <EmptySlotsCard date={date} />
        </div>
      </div>
    </Page>
  )
}
