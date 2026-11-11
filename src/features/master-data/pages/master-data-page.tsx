import {
  BookOpen,
  CalendarClock,
  CalendarRange,
  Clock,
  GraduationCap,
  School,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Page, PageHeader } from '@/components/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useActiveAcademicYear } from '../lookups'
import { AcademicYearsTab } from '../components/academic-years-tab'
import { ClassesTab } from '../components/classes-tab'
import { DutyTab } from '../components/duty-tab'
import { PeriodsTab } from '../components/periods-tab'
import { ShiftsTab } from '../components/shifts-tab'
import { StudentsTab } from '../components/students-tab'
import { SubjectsTab } from '../components/subjects-tab'
import { TeachersTab } from '../components/teachers-tab'
import { TimetableTab } from '../components/timetable-tab'

const TABS: { value: string; label: string; icon: ReactNode; Component: ComponentType }[] = [
  { value: 'tahun-ajaran', label: 'Tahun Ajaran', icon: <CalendarRange />, Component: AcademicYearsTab },
  { value: 'kelas', label: 'Kelas', icon: <School />, Component: ClassesTab },
  { value: 'siswa', label: 'Siswa', icon: <Users />, Component: StudentsTab },
  { value: 'guru', label: 'Guru', icon: <GraduationCap />, Component: TeachersTab },
  { value: 'mapel', label: 'Mata Pelajaran', icon: <BookOpen />, Component: SubjectsTab },
  { value: 'shift', label: 'Shift', icon: <Clock />, Component: ShiftsTab },
  { value: 'periode', label: 'Periode Jam', icon: <Timer />, Component: PeriodsTab },
  { value: 'jadwal', label: 'Jadwal Pelajaran', icon: <CalendarClock />, Component: TimetableTab },
  { value: 'piket', label: 'Petugas Piket', icon: <ShieldCheck />, Component: DutyTab },
]

/** /master — kelola data master (Admin/TU). Tab aktif disimpan di ?tab= (PRD §8.1). */
export function MasterDataPage() {
  const [sp, setSp] = useSearchParams()
  const { year, semester } = useActiveAcademicYear()
  const requested = sp.get('tab')
  const tab = TABS.some((t) => t.value === requested) ? (requested as string) : 'tahun-ajaran'

  return (
    <Page>
      <PageHeader
        title="Data Master"
        description={
          year ? (
            <>
              Periode aktif:{' '}
              <span className="font-medium text-foreground">
                {year.name}
                {semester ? ` · Semester ${semester.name}` : ''}
              </span>
            </>
          ) : (
            'Kelola tahun ajaran, kelas, siswa, guru, mata pelajaran, shift, jadwal, dan petugas piket.'
          )
        }
      />
      <Tabs
        value={tab}
        onValueChange={(value) =>
          // Ganti tab = buang filter tab sebelumnya agar URL tetap bersih.
          setSp(new URLSearchParams({ tab: value }), { replace: true })
        }
      >
        {/* 9 tab: daftar bergulir horizontal (tanpa bilah gulir) di layar sempit. */}
        <TabsList className="w-full sm:w-fit" aria-label="Kategori data master">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-none">
              {t.icon}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ value, Component }) => (
          <TabsContent key={value} value={value} className="pt-1">
            {tab === value && <Component />}
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  )
}
