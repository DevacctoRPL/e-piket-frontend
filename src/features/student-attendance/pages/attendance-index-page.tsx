import { ChevronRight, History, Loader2, School, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ContextHeader } from '@/components/context-header'
import { useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, Page, PageHeader } from '@/components/page'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/auth-context'
import { useClasses } from '@/features/master-data/lookups'
import { newIdempotencyKey } from '@/lib/api-client'
import { formatTime, todayISO } from '@/lib/date'
import { RECORD_STATUS_META } from '@/lib/enums'
import { getErrorMessage } from '@/lib/error-mapping'
import { cn } from '@/lib/utils'
import type { ClassRoom, ID, StudentAttendanceSession } from '@/types/entities'
import { SummaryCounts } from '../components/summary-counts'
import { useOpenSession, useSessions } from '../queries'

/** Pemilih konteks absensi: tanggal, shift, kelas (FR-STU-01, PRD §7.1 langkah 1). */
export function AttendanceIndexPage() {
  const { can } = useAuth()
  const canWrite = can('student_attendance:write')
  const today = todayISO()
  const { values, set } = useFilters({ date: today, shift: '' })
  const date = values.date > today ? today : values.date

  const classesQ = useClasses({ scope: 'mine' })
  const sessionsQ = useSessions({ date, shiftCode: values.shift || undefined })
  const openSession = useOpenSession()
  const navigate = useNavigate()
  const [openingId, setOpeningId] = useState<ID | null>(null)

  const sessionByClass = useMemo(() => {
    const m = new Map<ID, StudentAttendanceSession>()
    for (const s of sessionsQ.data ?? []) {
      if (s.sessionNumber === 1 || !m.has(s.classId)) m.set(s.classId, s)
    }
    return m
  }, [sessionsQ.data])

  const classes = useMemo(
    () =>
      (classesQ.data ?? []).filter(
        (c) => c.status === 'ACTIVE' && (!values.shift || c.shiftCode === values.shift),
      ),
    [classesQ.data, values.shift],
  )
  // Peran baca-saja hanya melihat sesi yang sudah dibuat.
  const visible = canWrite ? classes : classes.filter((c) => sessionByClass.has(c.id))

  const stats = useMemo(() => {
    let final = 0
    let draft = 0
    for (const c of classes) {
      const s = sessionByClass.get(c.id)
      if (s?.status === 'FINAL') final += 1
      else if (s) draft += 1
    }
    return { final, draft, none: classes.length - final - draft }
  }, [classes, sessionByClass])

  const open = (c: ClassRoom) => {
    const existing = sessionByClass.get(c.id)
    if (existing) {
      navigate(`sesi/${existing.id}`)
      return
    }
    if (!canWrite || openSession.isPending) return
    setOpeningId(c.id)
    openSession.mutate(
      { body: { date, shiftCode: c.shiftCode, classId: c.id, sessionNumber: 1 }, idempotencyKey: newIdempotencyKey() },
      {
        onSuccess: (s) => navigate(`sesi/${s.id}`),
        onError: (err) => toast.error(getErrorMessage(err)),
        onSettled: () => setOpeningId(null),
      },
    )
  }

  const loading = classesQ.isPending || sessionsQ.isPending
  const error = classesQ.error ?? sessionsQ.error

  return (
    <Page>
      <PageHeader
        title="Absensi Siswa"
        description="Pilih tanggal, shift, dan kelas untuk mengisi atau melihat absensi harian."
        actions={
          <Button asChild variant="outline">
            <Link to="riwayat">
              <History /> Riwayat siswa
            </Link>
          </Button>
        }
      />
      <ContextHeader
        date={date}
        onDateChange={(d) => set({ date: d })}
        shiftCode={values.shift}
        onShiftChange={(s) => set({ shift: s })}
        allowAllShifts
        maxDate={today}
      />

      {!loading && !error && classes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          <ToneBadge tone="success" className="tabular-nums">Final {stats.final}</ToneBadge>
          <ToneBadge tone="info" className="tabular-nums">Draft/Dikirim {stats.draft}</ToneBadge>
          <ToneBadge tone="neutral" className="tabular-nums">Belum dibuat {stats.none}</ToneBadge>
          <span className="text-muted-foreground tabular-nums">dari {classes.length} kelas</span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Memuat kelas">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void classesQ.refetch()
            void sessionsQ.refetch()
          }}
        />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<School className="size-5" />}
          title="Tidak ada kelas untuk ditampilkan"
          description={
            values.shift
              ? 'Tidak ada kelas pada shift ini yang menjadi tugas Anda. Coba pilih shift lain.'
              : 'Anda belum memiliki kelas yang ditugaskan. Hubungi admin sekolah untuk penugasan kelas.'
          }
          action={
            values.shift ? (
              <Button variant="outline" size="sm" onClick={() => set({ shift: '' })}>
                Tampilkan semua shift
              </Button>
            ) : undefined
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Belum ada absensi pada tanggal ini"
          description="Absensi kelas belum dibuat oleh guru/piket. Pilih tanggal lain untuk melihat data sebelumnya."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Daftar kelas">
          {visible.map((c) => {
            const s = sessionByClass.get(c.id)
            const opening = openingId === c.id
            const actionable = !!s || canWrite
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => open(c)}
                  disabled={!actionable || (openSession.isPending && !opening)}
                  aria-busy={opening || undefined}
                  className={cn(
                    'group flex h-full w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-xs transition-[border-color,box-shadow] duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    actionable && 'hover:border-primary/40 hover:shadow-sm',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.program}</p>
                    </div>
                    {s ? (
                      <StatusBadge meta={RECORD_STATUS_META} value={s.status} />
                    ) : (
                      <ToneBadge tone="neutral">Belum dibuat</ToneBadge>
                    )}
                  </div>
                  {s ? (
                    <SummaryCounts counts={s.summary} compact />
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="size-3.5" />
                      <span className="tabular-nums">{c.studentCount ?? '—'} siswa</span>
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-sm">
                    <span className="text-xs text-muted-foreground">
                      {s?.submittedAt
                        ? `Final ${formatTime(s.submittedAt)} · ${s.submittedByName ?? ''}`
                        : s
                          ? `Dibuat ${formatTime(s.createdAt)} · ${s.createdByName}`
                          : canWrite
                            ? 'Ketuk untuk mulai mengisi'
                            : 'Belum diisi'}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-semibold text-primary">
                      {opening ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Membuka…
                        </>
                      ) : (
                        <>
                          {s ? (s.status === 'FINAL' || !canWrite ? 'Lihat' : 'Lanjutkan') : 'Isi absensi'}
                          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Page>
  )
}
