import { FilterBar, FilterDate, FilterSelect } from '@/components/filter-bar'
import { useAuth } from '@/features/auth/auth-context'
import {
  useActiveAcademicYear,
  useClasses,
  useShifts,
  useSubjects,
  useTeachers,
} from '@/features/master-data/lookups'
import { formatDate } from '@/lib/date'
import type { Permission } from '@/types/entities'
import { useClassStudents } from '../queries'
import { PERIOD_OPTIONS, type ReportFilters } from '../lib/use-report-filters'

type Option = { value: string; label: string }

export interface ReportFilterConfig {
  shift?: boolean
  class?: boolean
  /** Pilihan siswa (muncul setelah kelas dipilih). Hanya ID yang masuk URL. */
  student?: boolean
  subject?: boolean
  /** Filter guru; tampil hanya bila user memiliki salah satu permission ini. */
  teacher?: Permission[]
  status?: { label: string; options: Option[] }
  type?: { label: string; options: Option[] }
  groupBy?: Option[]
}

export function ReportFilterBar({ filters, config }: { filters: ReportFilters; config: ReportFilterConfig }) {
  const { can } = useAuth()
  const { semester } = useActiveAcademicYear()
  const shifts = useShifts()
  const classes = useClasses({ scope: 'mine' })
  const subjects = useSubjects()
  const showTeacher = !!config.teacher && can(config.teacher)
  const teachers = useTeachers()
  const students = useClassStudents(config.student ? filters.values.classId : '')
  const { values, set } = filters

  const periodOptions = PERIOD_OPTIONS.map((o) =>
    o.value === 'semester' && semester
      ? { ...o, label: `Semester ${semester.name} (${formatDate(semester.startDate)} – ${formatDate(semester.endDate)})` }
      : o,
  )

  return (
    <FilterBar onReset={filters.isDirty ? filters.reset : undefined}>
      <FilterSelect
        label="Periode"
        value={filters.preset}
        onChange={(v) => filters.setPreset(v as typeof filters.preset)}
        options={periodOptions}
      />
      {filters.preset === 'custom' && filters.range && (
        <>
          <FilterDate
            label="Dari tanggal"
            value={filters.range.dateFrom}
            onChange={(v) => v && set({ dateFrom: v })}
          />
          <FilterDate
            label="Sampai tanggal"
            value={filters.range.dateTo}
            min={filters.range.dateFrom}
            onChange={(v) => v && set({ dateTo: v })}
          />
        </>
      )}
      {config.groupBy && (
        <FilterSelect
          label="Kelompokkan"
          value={filters.groupBy}
          onChange={(v) => set({ groupBy: v })}
          options={config.groupBy}
        />
      )}
      {config.shift && (
        <FilterSelect
          label="Shift"
          value={values.shiftCode}
          onChange={(v) => set({ shiftCode: v })}
          options={(shifts.data ?? []).map((s) => ({ value: s.code, label: s.name }))}
          allLabel="Semua shift"
        />
      )}
      {config.class && (
        <FilterSelect
          label="Kelas"
          value={values.classId}
          onChange={(v) => set({ classId: v, studentId: '' })}
          options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          allLabel={classes.isPending ? 'Memuat kelas…' : 'Semua kelas'}
        />
      )}
      {config.student && values.classId && (
        <FilterSelect
          label="Siswa"
          value={values.studentId}
          onChange={(v) => set({ studentId: v })}
          options={(students.data ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.nis})` }))}
          allLabel={students.isPending ? 'Memuat siswa…' : 'Semua siswa'}
        />
      )}
      {config.subject && (
        <FilterSelect
          label="Mata pelajaran"
          value={values.subjectId}
          onChange={(v) => set({ subjectId: v })}
          options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          allLabel="Semua mapel"
        />
      )}
      {showTeacher && (
        <FilterSelect
          label="Guru"
          value={values.teacherId}
          onChange={(v) => set({ teacherId: v })}
          options={(teachers.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          allLabel="Semua guru"
        />
      )}
      {config.status && (
        <FilterSelect
          label={config.status.label}
          value={values.status}
          onChange={(v) => set({ status: v })}
          options={config.status.options}
          allLabel="Semua status"
        />
      )}
      {config.type && (
        <FilterSelect
          label={config.type.label}
          value={values.type}
          onChange={(v) => set({ type: v })}
          options={config.type.options}
          allLabel="Semua jenis"
        />
      )}
    </FilterBar>
  )
}
