import { CalculatorIcon, ClipboardPen, ShieldCheck, Users } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FramedCard } from '@/components/framed-card'
import { EmptyState, ErrorState } from '@/components/page'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { SegmentedControl } from '@/components/segmented-control'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/auth-context'
import { useLookupMaps } from '@/features/master-data/lookups'
import { formatTime } from '@/lib/date'
import { TEACHER_ABSENT_STATUSES, TEACHER_ATTENDANCE_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { ISODate, ScheduledTeacherRow, ShiftCode, TeacherAttendance } from '@/types/entities'
import { useScheduledTeachers } from '../queries'
import {
  formatAffected,
  formatLate,
  matchesScheduledFilter,
  summarizeScheduled,
  type ScheduledFilter,
} from '../utils'
import { OverrideDialog } from './override-dialog'
import { RecordStatusDialog } from './record-status-dialog'

const FILTERS: { key: ScheduledFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'present', label: 'Hadir' },
  { key: 'late', label: 'Terlambat' },
  { key: 'absent', label: 'Tidak hadir' },
  { key: 'notCheckedIn', label: 'Belum check-in' },
]

const DESCRIPTION = 'Hanya guru yang memiliki jadwal mengajar atau tugas piket pada tanggal ini.'

/** Daftar "Guru Terjadwal" (FR-TCH-02..04, §7.3). */
export function ScheduledTeachers({ date, shiftCode }: { date: ISODate; shiftCode: ShiftCode | '' }) {
  const q = useScheduledTeachers(date, shiftCode)
  const { can } = useAuth()
  const canWrite = can('teacher_attendance:write')
  const lookups = useLookupMaps()
  const [filter, setFilter] = useState<ScheduledFilter>('all')
  const [recordRow, setRecordRow] = useState<ScheduledTeacherRow | null>(null)
  const [overrideFor, setOverrideFor] = useState<TeacherAttendance | null>(null)
  const reload = () => void q.refetch()

  const summary = useMemo(() => summarizeScheduled(q.data ?? []), [q.data])
  const rows = useMemo(() => (q.data ?? []).filter((r) => matchesScheduledFilter(r, filter)), [q.data, filter])

  const { classById } = lookups
  const slotLabel = useCallback(
    (r: ScheduledTeacherRow) => {
      if (r.slots.length === 0) return r.isDutyTeacher ? 'Tugas piket' : '—'
      return r.slots
        .map((s) => `${classById.get(s.classId)?.name ?? '…'} (jam ${s.periodStart}–${s.periodEnd})`)
        .join(', ')
    },
    [classById],
  )

  const columns = useMemo<ColumnDef<ScheduledTeacherRow, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Guru',
        accessorFn: (r) => r.teacher.name,
        cell: ({ row: { original: r } }) => (
          <div className="min-w-0">
            <p className="font-medium">{r.teacher.name}</p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              NIP {r.teacher.nip}
              {r.isDutyTeacher && (
                <ToneBadge tone="success" icon={ShieldCheck}>
                  Piket
                </ToneBadge>
              )}
            </p>
          </div>
        ),
      },
      {
        id: 'schedule',
        header: 'Jam terjadwal',
        accessorFn: (r) => r.scheduledPeriods,
        cell: ({ row: { original: r } }) => (
          <div className="min-w-0 max-w-64">
            <p className="font-medium tabular-nums">{r.scheduledPeriods} jam</p>
            <SlotLabel row={r} label={slotLabel} />
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => r.attendance?.status ?? '',
        cell: ({ row: { original: r } }) =>
          r.attendance ? (
            <div className="flex flex-col gap-0.5">
              <StatusBadge meta={TEACHER_ATTENDANCE_META} value={r.attendance.status} />
              {r.attendance.lateMinutes ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  +{formatLate(r.attendance.lateMinutes)}
                </span>
              ) : null}
            </div>
          ) : (
            <ToneBadge tone="neutral">Belum check-in</ToneBadge>
          ),
      },
      {
        id: 'times',
        header: 'Datang / Pulang',
        enableSorting: false,
        cell: ({ row: { original: r } }) => (
          <span className="tabular-nums">
            {formatTime(r.attendance?.checkInAt)} / {formatTime(r.attendance?.checkOutAt)}
          </span>
        ),
      },
      {
        id: 'reason',
        header: 'Alasan',
        enableSorting: false,
        cell: ({ row: { original: r } }) => (
          <span className={cn('line-clamp-2 max-w-56', !r.attendance?.reason && 'text-muted-foreground')}>
            {r.attendance?.reason ?? '—'}
          </span>
        ),
      },
      {
        id: 'affected',
        header: 'Jam terdampak',
        accessorFn: (r) => r.attendance?.affectedPeriods ?? 0,
        cell: ({ row: { original: r } }) => {
          const a = r.attendance
          if (!a || !TEACHER_ABSENT_STATUSES.includes(a.status)) {
            return a?.affectedPeriodsOverride != null ? (
              <span className="tabular-nums">{formatAffected(a)}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
          return (
            <span
              className={cn('tabular-nums', a.affectedPeriods > 0 && 'font-semibold text-tone-danger')}
              title={a.overrideReason ? `Alasan koreksi: ${a.overrideReason}` : undefined}
            >
              {formatAffected(a)}
            </span>
          )
        },
      },
      ...(canWrite
        ? [
            {
              id: 'actions',
              header: () => <span className="sr-only">Aksi</span>,
              enableSorting: false,
              meta: { className: 'text-right', headerClassName: 'text-right' },
              cell: ({ row: { original: r } }: { row: { original: ScheduledTeacherRow } }) => (
                <RowActions row={r} onRecord={setRecordRow} onOverride={setOverrideFor} />
              ),
            } satisfies ColumnDef<ScheduledTeacherRow, unknown>,
          ]
        : []),
    ],
    [canWrite, slotLabel],
  )

  const filterControl = (
    <SegmentedControl
      ariaLabel="Saring status"
      size="sm"
      className="no-print"
      value={filter}
      onChange={setFilter}
      options={FILTERS.map((c) => ({
        value: c.key,
        label: c.label,
        count: q.data ? (c.key === 'all' ? summary.total : summary[c.key]) : undefined,
      }))}
    />
  )

  /** Bingkai untuk status memuat/error/kosong — judul & filter tetap terlihat. */
  const frame = (children: ReactNode) => (
    <FramedCard
      title="Guru Terjadwal"
      titleId="scheduled-title"
      icon={<Users />}
      description={DESCRIPTION}
      headerRight={filterControl}
    >
      {children}
    </FramedCard>
  )

  return (
    <>
      {q.isPending ? (
        frame(
          <div className="grid gap-2.5" aria-busy="true" aria-label="Memuat data">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>,
        )
      ) : q.isError || !q.data ? (
        frame(<ErrorState error={q.error} onRetry={reload} className="border-0 py-6 shadow-none" />)
      ) : q.data.length === 0 ? (
        frame(
          <EmptyState
            icon={<Users className="size-5" />}
            title="Tidak ada guru terjadwal"
            description="Tidak ada jadwal mengajar maupun tugas piket pada tanggal/shift ini. Pilih tanggal atau shift lain."
            className="border-0 bg-transparent py-6"
          />,
        )
      ) : (
        <div className="flex flex-col gap-1.5">
          <DataTable
            title="Guru Terjadwal"
            icon={<Users />}
            toolbar={filterControl}
            columns={columns}
            data={rows}
            getRowId={(r) => r.teacher.id}
            caption="Daftar guru terjadwal"
            pageSize={25}
            emptyState={
              <EmptyState
                title="Tidak ada guru pada kategori ini"
                description="Pilih kategori lain untuk melihat guru terjadwal."
                className="border-0 bg-transparent py-8"
                action={
                  <Button variant="outline" size="sm" onClick={() => setFilter('all')}>
                    Tampilkan semua
                  </Button>
                }
              />
            }
            renderMobileCard={(r) => (
              <MobileCard
                row={r}
                slotLabel={slotLabel(r)}
                actions={canWrite ? <RowActions row={r} onRecord={setRecordRow} onOverride={setOverrideFor} /> : null}
              />
            )}
          />
          <p className="px-1 text-xs text-muted-foreground">{DESCRIPTION}</p>
        </div>
      )}

      <RecordStatusDialog
        row={recordRow}
        date={date}
        shiftCode={shiftCode}
        open={!!recordRow}
        onOpenChange={(o) => !o && setRecordRow(null)}
        onReload={reload}
      />
      <OverrideDialog
        attendance={overrideFor}
        open={!!overrideFor}
        onOpenChange={(o) => !o && setOverrideFor(null)}
        onReload={reload}
      />
    </>
  )
}

function SlotLabel({ row, label }: { row: ScheduledTeacherRow; label: (r: ScheduledTeacherRow) => string }) {
  const text = label(row)
  return (
    <p className="truncate text-xs text-muted-foreground" title={text}>
      {text}
    </p>
  )
}

/**
 * Aksi utama baris = "Catat status" / "Ubah" (tombol kecil); aksi sekunder (koreksi jam terdampak) di kebab.
 * Slot kebab selalu disediakan agar tombol utama sejajar antarbaris.
 */
function RowActions({
  row,
  onRecord,
  onOverride,
}: {
  row: ScheduledTeacherRow
  onRecord: (r: ScheduledTeacherRow) => void
  onOverride: (a: TeacherAttendance) => void
}) {
  const a = row.attendance
  const absent = !!a && TEACHER_ABSENT_STATUSES.includes(a.status)
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={() => onRecord(row)}
        aria-label={`${a ? 'Ubah status' : 'Catat status'} ${row.teacher.name}`}
      >
        <ClipboardPen /> {a ? 'Ubah' : 'Catat status'}
      </Button>
      {a && absent ? (
        <RowActionsMenu
          label={`Aksi untuk ${row.teacher.name}`}
          actions={[{ label: 'Koreksi jam terdampak', icon: CalculatorIcon, onSelect: () => onOverride(a) }]}
        />
      ) : (
        <span aria-hidden className="size-7 shrink-0" />
      )}
    </div>
  )
}

function MobileCard({
  row: r,
  slotLabel,
  actions,
}: {
  row: ScheduledTeacherRow
  slotLabel: string
  actions: React.ReactNode
}) {
  const a = r.attendance
  const absent = !!a && TEACHER_ABSENT_STATUSES.includes(a.status)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{r.teacher.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {r.scheduledPeriods} jam · {slotLabel}
          </p>
        </div>
        {a ? (
          <StatusBadge meta={TEACHER_ATTENDANCE_META} value={a.status} />
        ) : (
          <ToneBadge tone="neutral">Belum check-in</ToneBadge>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Datang / Pulang</dt>
        <dd className="tabular-nums">
          {formatTime(a?.checkInAt)} / {formatTime(a?.checkOutAt)}
          {a?.lateMinutes ? <span className="text-muted-foreground"> · +{formatLate(a.lateMinutes)}</span> : null}
        </dd>
        {a?.reason && (
          <>
            <dt className="text-muted-foreground">Alasan</dt>
            <dd className="break-words">{a.reason}</dd>
          </>
        )}
        {absent && a && (
          <>
            <dt className="text-muted-foreground">Jam terdampak</dt>
            <dd className="font-semibold text-tone-danger tabular-nums">{formatAffected(a)}</dd>
          </>
        )}
        {r.isDutyTeacher && (
          <>
            <dt className="text-muted-foreground">Tugas</dt>
            <dd>Guru piket</dd>
          </>
        )}
      </dl>
      {actions && <div className="flex justify-end border-t border-border/70 pt-2">{actions}</div>}
    </div>
  )
}
