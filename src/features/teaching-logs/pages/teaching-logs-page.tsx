import { CalendarClock, History } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { ContextHeader } from '@/components/context-header'
import { Page, PageHeader } from '@/components/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/auth-context'
import { todayISO } from '@/lib/date'
import { HistoryPanel } from '../components/history-panel'
import { TodaySchedule } from '../components/today-schedule'

type Tab = 'hari-ini' | 'riwayat'

/** Halaman utama Jurnal Mengajar: jadwal hari ini (guru) + riwayat (semua yang berhak membaca). */
export function TeachingLogsPage() {
  const { can } = useAuth()
  const canWrite = can('teaching_log:write')
  const [sp, setSp] = useSearchParams()
  const tab: Tab = canWrite && sp.get('tab') !== 'riwayat' ? 'hari-ini' : 'riwayat'
  const today = todayISO()
  const date = sp.get('tanggal') ?? today

  const setParam = (key: string, value: string | null) =>
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )

  return (
    <Page>
      <PageHeader
        title="Jurnal Mengajar"
        description={
          canWrite
            ? 'Catat materi, kegiatan, dan kehadiran siswa untuk setiap pertemuan sesuai jadwal Anda.'
            : 'Tinjau agenda kegiatan mengajar guru: materi, kegiatan, jumlah jam, dan pengesahan.'
        }
      />

      {canWrite ? (
        <Tabs value={tab} onValueChange={(t) => setParam('tab', t === 'riwayat' ? 'riwayat' : null)}>
          <TabsList className="no-print w-full sm:w-fit">
            <TabsTrigger value="hari-ini">
              <CalendarClock /> Jadwal hari ini
            </TabsTrigger>
            <TabsTrigger value="riwayat">
              <History /> Riwayat
            </TabsTrigger>
          </TabsList>
          <TabsContent value="hari-ini" className="grid gap-4">
            <ContextHeader
              date={date}
              onDateChange={(d) => setParam('tanggal', d === today ? null : d)}
            />
            <TodaySchedule date={date} />
          </TabsContent>
          <TabsContent value="riwayat">
            <HistoryPanel />
          </TabsContent>
        </Tabs>
      ) : (
        <HistoryPanel />
      )}
    </Page>
  )
}
