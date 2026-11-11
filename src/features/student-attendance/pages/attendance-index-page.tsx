import { ChevronRight, CircleDashed, FilePen, History, Loader2, LockKeyhole, School, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ContextHeader } from '@/components/context-header'
import { useFilters } from '@/components/filter-bar'
import { NativeSelect } from '@/components/form-field'
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

/** Pemilih konteks absensi: tanggal, shift, kelas, dan sesi (FR-STU-01, PRD §7.1 langkah 1). */
export function AttendanceIndexPage() {
  const { can } = useAuth()
  const canWrite = can('student_attendance:write')
  const today = todayISO()
  const { values, set } = useFilters({ date: today, shift: '', classId: '', session: '1' })
  const date = values.date > today ? today : values.date
  const sessionNumber = values.session === '2' ? 2 : 1

  const classesQ = useClasses({ scope: 'mine' })
  const sessionsQ = useSessions({ date, shiftCode: values.shift || undefined })
  const openSession = useOpenSession()
  const navigate = useNavigate()
  const [openingId, setOpeningId] = useState<ID | null>(null)

  const sessionByClass = useMemo(() => {
    const m = new Map<ID, StudentAttendanceSession>()
    for (const s of sessionsQ.data ?? []) {
      if (s.sessionNumber === sessionNumber) m.set(s.classId, s)
    }
    return m
  }, [sessionsQ.data, sessionNumber])

  const classes = useMemo(
    () =>
      (classesQ.data ?? []).filter(
        (c) =>
          c.status === 'ACTIVE' &&
          (!values.shift || c.shiftCode === values.shift) &&
          (!values.classId || c.id === values.classId),
      ),
    [classesQ.data, values.shift, values.classId],
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
      { body: { date, shiftCode: c.shiftCode, classId: c.id, sessionNumber }, idempotencyKey: newIdempotencyKey() },
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
        description="Pilih tanggal, shift, sesi, dan kelas untuk mengisi atau melihat absensi harian."
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
        extra={
          <>
            <NativeSelect
              value={String(sessionNumber)}
              onChange={(e) => set({ session: e.target.value })}
              aria-label="Sesi"
              className="w-auto min-w-28"
            >
              <option value="1">Sesi 1 (Awal)</option>
              <option value="2">Sesi 2 (Akhir)</option>
            </NativeSelect>
            {values.classId && (
              <Button variant="outline" onClick={() => set({ classId: '' })}>
                <X className="size-3.5" /> Semua kelas
              </Button>
            )}
          </>
        }
      />

      {!loading && !error && classes.length > 0 && (
        <p
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole aria-hidden className="size-3.5 text-tone-success" />
            <span className="font-medium text-foreground/85">Final {stats.final}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FilePen aria-hidden className="size-3.5 text-tone-info" />
            <span className="font-medium text-foreground/85">Draft/Dikirim {stats.draft}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CircleDashed aria-hidden className="size-3.5" />
            <span className="font-medium text-foreground/85">Belum dibuat {stats.none}</span>
          </span>
          <span>dari {classes.length} kelas</span>
        </p>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Memuat kelas">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
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
                    'flex h-full w-full flex-col gap-3 rounded-xl border border-border/85 bg-card p-3.5 text-left shadow-2xs transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    actionable && 'hover:border-foreground/25 hover:bg-accent/30',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
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
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-2.5 text-[13px]">
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {s?.submittedAt
                        ? `Final ${formatTime(s.submittedAt)} · ${s.submittedByName ?? ''}`
                        : s
                          ? `Dibuat ${formatTime(s.createdAt)} · ${s.createdByName}`
                          : canWrite
                            ? 'Ketuk untuk mulai mengisi'
                            : 'Belum diisi'}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-medium text-foreground">
                      {opening ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> Membuka…
                        </>
                      ) : (
                        <>
                          {s ? (s.status === 'FINAL' || !canWrite ? 'Lihat' : 'Lanjutkan') : 'Isi absensi'}
                          <ChevronRight className="size-3.5 text-muted-foreground" />
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
