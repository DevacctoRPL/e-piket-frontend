import { useMemo } from 'react'
import { useParams } from 'react-router'
import { ErrorState, Page, PageHeader } from '@/components/page'
import { Skeleton } from '@/components/ui/misc'
import { usePeriods } from '@/features/master-data/lookups'
import { formatDateLong } from '@/lib/date'
import type { Period, TeachingLog } from '@/types/entities'
import { TeachingLogForm } from '../components/teaching-log-form'
import { useTeachingLog } from '../queries'
import type { TeachingLogContext } from '../types'

function contextFromLog(log: TeachingLog, periods: Period[] | undefined): TeachingLogContext {
  const ps = (periods ?? []).filter((p) => p.shiftCode === log.shiftCode)
  return {
    date: log.date,
    timetableSlotId: log.timetableSlotId,
    substitutionRecordId: log.substitutionRecordId,
    isSubstitution: !!log.substitutionRecordId,
    classId: log.classId,
    className: log.className,
    subjectId: log.subjectId,
    subjectName: log.subjectName,
    shiftCode: log.shiftCode,
    periodStart: log.periodStart,
    periodEnd: log.periodEnd,
    startTime: ps.find((p) => p.number === log.periodStart)?.startTime ?? null,
    endTime: ps.find((p) => p.number === log.periodEnd)?.endTime ?? null,
  }
}

/** /jurnal-mengajar/:id — lihat, lanjutkan draft, koreksi, atau sahkan jurnal. */
export function TeachingLogDetailPage() {
  const { id } = useParams()
  const query = useTeachingLog(id)
  const periods = usePeriods()
  const log = query.data
  const ctx = useMemo(() => (log ? contextFromLog(log, periods.data) : null), [log, periods.data])

  return (
    <Page className="max-w-4xl">
      <PageHeader
        title={log ? `Jurnal ${log.subjectName} · ${log.className}` : 'Jurnal mengajar'}
        description={log ? formatDateLong(log.date) : undefined}
      />
      {query.isPending ? (
        <div className="grid gap-4" aria-busy="true" aria-label="Memuat jurnal">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : query.isError || !log ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <TeachingLogForm
          key={`${log.id}-${log.version}`}
          context={ctx}
          log={log}
          initialDate={log.date}
          onReload={() => void query.refetch()}
        />
      )}
    </Page>
  )
}
