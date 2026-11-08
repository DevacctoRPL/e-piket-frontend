import { CalendarX2 } from 'lucide-react'
import { useRef } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { EmptyState, ErrorState, Page, PageHeader } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/auth-context'
import { formatDateLong, todayISO } from '@/lib/date'
import { TeachingLogForm } from '../components/teaching-log-form'
import { useTodayTeachingSlots } from '../queries'
import { contextFromSlot } from '../meta'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** /jurnal-mengajar/baru?slot=<timetableSlotId>&date=YYYY-MM-DD — atau tanpa slot (di luar jadwal). */
export function TeachingLogNewPage() {
  const [sp] = useSearchParams()
  const { can } = useAuth()
  const rawDate = sp.get('date')
  const date = rawDate && ISO_DATE.test(rawDate) && rawDate <= todayISO() ? rawDate : todayISO()
  const slotId = sp.get('slot')
  const canWrite = can('teaching_log:write')
  const today = useTodayTeachingSlots(date, !!slotId && canWrite)
  const hadLogOnOpen = useRef<boolean | null>(null)

  const header = (
    <PageHeader
      title={slotId ? 'Isi jurnal mengajar' : 'Jurnal di luar jadwal'}
      description={formatDateLong(date)}
    />
  )

  // Tanpa slot, atau role koreksi tanpa jadwal pribadi (admin/pimpinan) → jurnal di luar jadwal.
  if (!slotId || !canWrite) {
    return (
      <Page className="max-w-4xl">
        {header}
        <TeachingLogForm context={null} log={null} initialDate={date} />
      </Page>
    )
  }

  if (today.isPending) {
    return (
      <Page className="max-w-4xl">
        {header}
        <div className="grid gap-4" aria-busy="true" aria-label="Memuat jadwal">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </Page>
    )
  }
  if (today.isError) {
    return (
      <Page className="max-w-4xl">
        {header}
        <ErrorState error={today.error} onRetry={() => void today.refetch()} />
      </Page>
    )
  }

  const item = today.data.find((s) => s.slot.id === slotId)
  if (!item) {
    return (
      <Page className="max-w-4xl">
        {header}
        <EmptyState
          icon={<CalendarX2 className="size-5" />}
          title="Jadwal tidak ditemukan"
          description="Slot ini bukan jadwal mengajar atau tugas pengganti Anda pada tanggal tersebut. Kembali ke jadwal hari ini untuk memilih pertemuan."
          action={
            <Button asChild variant="outline">
              <Link to="/jurnal-mengajar">Kembali ke jadwal</Link>
            </Button>
          }
        />
      </Page>
    )
  }
  // Jurnal untuk slot ini sudah ada saat halaman dibuka → buka jurnal tersebut (cegah duplikat).
  // Hanya dievaluasi pada pemuatan pertama: setelah form ini menyimpan, navigasi diatur oleh form.
  if (hadLogOnOpen.current === null) hadLogOnOpen.current = !!item.log
  if (item.log && hadLogOnOpen.current) return <Navigate to={`/jurnal-mengajar/${encodeURIComponent(item.log.id)}`} replace />

  return (
    <Page className="max-w-4xl">
      {header}
      <TeachingLogForm context={contextFromSlot(item, date)} log={null} initialDate={date} />
    </Page>
  )
}
