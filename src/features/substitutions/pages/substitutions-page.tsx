import { CalendarClock, CheckCircle2, CircleAlert, Clock, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ContextHeader } from '@/components/context-header'
import { FilterSelect, useFilters } from '@/components/filter-bar'
import { CardsSkeleton, EmptyState, ErrorState, Page, PageHeader, StatCard } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/auth-context'
import { useClasses } from '@/features/master-data/lookups'
import { todayISO } from '@/lib/date'
import type { SubstitutionSlot } from '@/types/entities'
import { AssignSheet } from '../components/assign-sheet'
import { CancelRecordDialog } from '../components/cancel-record-dialog'
import { EditRecordDialog } from '../components/edit-record-dialog'
import { HistoryTab } from '../components/history-tab'
import { SlotCard } from '../components/slot-card'
import { useSubstitutionSlots, useSubstitutionSummary } from '../queries'

/** Halaman Jam Kosong / Guru Pengganti (PRD §6.8, §7.5, AC-09). */
export function SubstitutionsPage() {
  const today = todayISO()
  const { values, set } = useFilters({ date: today, shift: '', classId: '', tab: 'slots' })

  return (
    <Page>
      <PageHeader
        title="Jam Kosong / Guru Pengganti"
        description="Slot pelajaran yang gurunya berhalangan, diambil dari jadwal aktif dan absensi guru. Tetapkan guru pengganti agar tidak ada kelas yang kosong."
      />
      <Tabs value={values.tab} onValueChange={(v) => set({ tab: v })}>
        <TabsList>
          <TabsTrigger value="slots">Jam kosong</TabsTrigger>
          <TabsTrigger value="history">Riwayat</TabsTrigger>
        </TabsList>
        <TabsContent value="slots" className="space-y-5">
          <SlotsView
            date={values.date}
            shiftCode={values.shift}
            classId={values.classId}
            onDate={(date) => set({ date })}
            onShift={(shift) => set({ shift })}
            onClass={(classId) => set({ classId })}
          />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </Page>
  )
}

function SlotsView({
  date,
  shiftCode,
  classId,
  onDate,
  onShift,
  onClass,
}: {
  date: string
  shiftCode: string
  classId: string
  onDate: (v: string) => void
  onShift: (v: string) => void
  onClass: (v: string) => void
}) {
  const { can } = useAuth()
  const classes = useClasses({ shiftCode: shiftCode || undefined })
  const params = { date, shiftCode: shiftCode || undefined, classId: classId || undefined }
  const slotsQ = useSubstitutionSlots(params)
  const summaryQ = useSubstitutionSummary(params)

  const [assignSlot, setAssignSlot] = useState<SubstitutionSlot | null>(null)
  const [editSlot, setEditSlot] = useState<SubstitutionSlot | null>(null)
  const [cancelSlot, setCancelSlot] = useState<SubstitutionSlot | null>(null)

  const { unhandled, handled } = useMemo(() => {
    const items = slotsQ.data ?? []
    return {
      unhandled: items.filter((s) => s.status === 'UNHANDLED'),
      handled: items.filter((s) => s.status === 'HANDLED'),
    }
  }, [slotsQ.data])

  const s = summaryQ.data
  const refreshing = slotsQ.isFetching || summaryQ.isFetching

  return (
    <>
      <ContextHeader
        date={date}
        onDateChange={onDate}
        shiftCode={shiftCode}
        onShiftChange={(v) => {
          onShift(v)
          if (classId) onClass('')
        }}
        allowAllShifts
        extra={
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              void slotsQ.refetch()
              void summaryQ.refetch()
            }}
            disabled={refreshing}
            aria-label="Muat ulang"
          >
            <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
          </Button>
        }
      />

      {summaryQ.isPending ? (
        <CardsSkeleton count={3} />
      ) : summaryQ.isError ? (
        <ErrorState error={summaryQ.error} onRetry={() => void summaryQ.refetch()} />
      ) : (
        s && (
          <section aria-label="Ringkasan jam kosong" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Jam terdampak"
              value={`${s.affectedPeriods} jam`}
              hint={`${s.affectedSlots} slot dari guru berhalangan`}
              icon={<Clock />}
              tone="info"
            />
            <StatCard
              label="Sudah digantikan"
              value={`${s.handledPeriods} jam`}
              hint={`${s.handledSlots} slot tertangani`}
              icon={<CheckCircle2 />}
              tone="success"
            />
            <StatCard
              label="Belum tertangani"
              value={`${s.unhandledPeriods} jam`}
              hint={`${s.unhandledSlots} slot perlu guru pengganti`}
              icon={<CircleAlert />}
              tone={s.unhandledSlots > 0 ? 'danger' : 'neutral'}
            />
          </section>
        )
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterSelect
          label="Kelas"
          value={classId}
          onChange={onClass}
          allLabel="Semua kelas"
          options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          className="w-full sm:w-56"
        />
      </div>

      {slotsQ.isPending ? (
        <div className="grid gap-3 md:grid-cols-2" aria-busy="true" aria-label="Memuat jam kosong">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : slotsQ.isError ? (
        <ErrorState error={slotsQ.error} onRetry={() => void slotsQ.refetch()} />
      ) : slotsQ.data.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-5" />}
          title="Tidak ada jam kosong"
          description={
            classId
              ? 'Tidak ada guru berhalangan yang mengajar kelas ini pada tanggal dan shift terpilih.'
              : 'Semua guru terjadwal hadir pada tanggal dan shift ini. Jam kosong akan muncul otomatis bila absensi guru dicatat sakit, izin, alpa, atau dinas luar.'
          }
          action={
            can('teacher_attendance:read') ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/absensi-guru">Buka absensi guru</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={slotsQ.isPlaceholderData ? 'space-y-6 opacity-60 transition-opacity' : 'space-y-6'}>
          <SlotGroup
            title="Belum tertangani"
            count={unhandled.length}
            tone="danger"
            empty="Semua jam kosong sudah memiliki guru pengganti."
            slots={unhandled}
            showShift={!shiftCode}
            onAssign={setAssignSlot}
            onEdit={setEditSlot}
            onCancel={setCancelSlot}
          />
          <SlotGroup
            title="Sudah digantikan"
            count={handled.length}
            tone="success"
            empty="Belum ada jam kosong yang ditangani guru pengganti."
            slots={handled}
            showShift={!shiftCode}
            onAssign={setAssignSlot}
            onEdit={setEditSlot}
            onCancel={setCancelSlot}
          />
        </div>
      )}

      <AssignSheet slot={assignSlot} onOpenChange={(o) => !o && setAssignSlot(null)} />
      <EditRecordDialog
        record={editSlot?.substitution ?? null}
        className={editSlot?.className}
        onOpenChange={(o) => !o && setEditSlot(null)}
      />
      <CancelRecordDialog
        record={cancelSlot?.substitution ?? null}
        className={cancelSlot?.className}
        onOpenChange={(o) => !o && setCancelSlot(null)}
      />
    </>
  )
}

function SlotGroup({
  title,
  count,
  tone,
  empty,
  slots,
  showShift,
  onAssign,
  onEdit,
  onCancel,
}: {
  title: string
  count: number
  tone: 'danger' | 'success'
  empty: string
  slots: SubstitutionSlot[]
  showShift: boolean
  onAssign: (s: SubstitutionSlot) => void
  onEdit: (s: SubstitutionSlot) => void
  onCancel: (s: SubstitutionSlot) => void
}) {
  const id = `group-${tone}`
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="flex items-center gap-2 text-base font-semibold">
        {title}
        <span
          className={
            tone === 'danger'
              ? 'rounded-full bg-tone-danger-bg px-2 py-0.5 text-xs text-tone-danger tabular-nums'
              : 'rounded-full bg-tone-success-bg px-2 py-0.5 text-xs text-tone-success tabular-nums'
          }
        >
          {count} slot
        </span>
      </h2>
      {slots.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              showShift={showShift}
              onAssign={onAssign}
              onEdit={onEdit}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}
    </section>
  )
}
