import { BarChart3 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { FramedCard } from '@/components/framed-card'
import { SegmentedControl } from '@/components/segmented-control'
import { deltaTone, formatDelta, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DashboardTrends } from '@/types/entities'

// Building block bersama kini tinggal di src/components — diekspor ulang agar impor lama tetap jalan.
export { FramedCard } from '@/components/framed-card'
export { KpiCard as KpiSparkCard, type KpiCardProps as KpiSparkCardProps } from '@/components/kpi-card'

type TrendMetric = 'present' | 'nonPresent' | 'logs'

const METRICS: Record<TrendMetric, { label: string; unit: string; upIsGood: boolean }> = {
  present: { label: 'Hadir', unit: 'siswa hadir', upIsGood: true },
  nonPresent: { label: 'S/I/A', unit: 'siswa S/I/A', upIsGood: false },
  logs: { label: 'Jurnal', unit: 'jurnal terisi', upIsGood: true },
}

/** Langkah sumbu Y yang "bulat" (1/2/2,5/5 × 10ⁿ) agar 4 interval berlabel rapi. */
function niceMax(raw: number) {
  const target = Math.max(4, raw) / 4
  const pow = 10 ** Math.floor(Math.log10(target))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= target) ?? 10 * pow
  return step * 4
}

/**
 * Grafik batang 7 hari (setara "Ticket Volume Trend" referensi Nuvio):
 * satu batang abu per hari, batang tanggal terpilih gelap dengan garis referensi putus-putus
 * dan tooltip kecil; sumbu Y di kanan; tinggi batang proporsional terhadap sumbu.
 */
export function AttendanceTrendChart({
  trends,
  footer,
  selectedDate,
}: {
  trends: DashboardTrends
  footer?: ReactNode
  /** Tanggal yang disorot pertama kali (default: hari terakhir pada deret). */
  selectedDate?: string
}) {
  const [metric, setMetric] = useState<TrendMetric>('present')
  const days = trends.days
  const initialIdx = Math.max(
    0,
    selectedDate ? days.findIndex((d) => d.date === selectedDate) : days.length - 1,
  )
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const activeIdx = Math.min(hoverIdx ?? initialIdx, Math.max(0, days.length - 1))

  const meta = METRICS[metric]
  const values = days.map((d) =>
    metric === 'nonPresent' ? d.nonPresent : metric === 'logs' ? d.logsFilled : d.present,
  )
  const total = values.reduce((a, b) => a + b, 0)
  const deltaPct =
    metric === 'nonPresent'
      ? trends.nonPresentDeltaPct
      : metric === 'logs'
        ? trends.logComplianceDeltaPct
        : trends.presentDeltaPct
  const tone = deltaTone(deltaPct, meta.upIsGood)

  const yMax = niceMax(Math.max(...values, 1))
  const yTicks = [yMax, (yMax * 3) / 4, yMax / 2, yMax / 4, 0]

  return (
    <FramedCard
      title="Tren Kehadiran"
      titleId="trend-chart-title"
      icon={<BarChart3 />}
      headerRight={
        <SegmentedControl
          ariaLabel="Metrik grafik"
          size="sm"
          value={metric}
          onChange={setMetric}
          options={(Object.keys(METRICS) as TrendMetric[]).map((k) => ({ value: k, label: METRICS[k].label }))}
        />
      }
      bodyClassName="gap-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-[28px] leading-none font-semibold tracking-tight tabular-nums">
          {formatNumber(total)}
        </span>
        <span className="text-xs">
          <span
            className={cn(
              'font-semibold tabular-nums',
              tone === 'good' && 'text-tone-success',
              tone === 'bad' && 'text-tone-danger',
              tone === 'flat' && 'text-muted-foreground',
            )}
          >
            {formatDelta(deltaPct)}
          </span>{' '}
          <span className="text-muted-foreground">vs pekan lalu · {meta.unit}, 7 hari</span>
        </span>
      </div>

      <figure aria-labelledby="trend-chart-title" className="m-0">
        <figcaption className="sr-only">
          {days.map((d, i) => `${d.dayShort} ${d.date}: ${values[i]} ${meta.unit}`).join('; ')}
        </figcaption>
        <div className="grid grid-cols-[1fr_auto] gap-3" aria-hidden>
          {/* Area plot */}
          {/* overflow-x-clip: garis referensi berhenti tepat di tepi kanan plot, tooltip tetap bebas ke atas */}
          <div className="relative h-56 overflow-x-clip" onPointerLeave={() => setHoverIdx(null)}>
            {/* garis grid */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              {yTicks.map((t, i) => (
                <div
                  key={t}
                  className={cn('border-t', i === yTicks.length - 1 ? 'border-border' : 'border-chart-grid')}
                />
              ))}
            </div>

            <div className="relative grid h-full grid-cols-7 items-end gap-2.5 px-1 sm:gap-5 sm:px-2">
              {days.map((d, i) => {
                const isActive = i === activeIdx
                const pct = ((values[i] ?? 0) / yMax) * 100
                const height = `${Math.max(pct, values[i] ? 2 : 0)}%`
                return (
                  <div
                    key={d.date}
                    className={cn('relative flex h-full items-end justify-center', isActive && 'z-20')}
                    onPointerEnter={() => setHoverIdx(i)}
                  >
                    <span
                      className={cn(
                        'relative w-full max-w-12 transition-[height] duration-200',
                        isActive ? 'chart-bar-active z-10' : 'chart-bar',
                      )}
                      style={{ height }}
                    >
                      {isActive && (
                        <>
                          {/* garis referensi dari tepi kanan batang ke sumbu Y */}
                          <span
                            aria-hidden
                            className="chart-ref-line pointer-events-none absolute top-0 left-full w-[200vw] -translate-y-1/2"
                          />
                          {/* tooltip gelap di kiri-atas batang, tengah vertikal di puncak batang */}
                          <span
                            className={cn(
                              'pointer-events-none absolute top-0 -translate-y-1/2 rounded-md border border-white/10 bg-chart-tooltip px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-primary-foreground shadow-sm shadow-black/15 tabular-nums',
                              i === 0 ? 'left-[calc(100%-14px)]' : 'right-[calc(100%-14px)]',
                            )}
                          >
                            {d.dayShort}: {formatNumber(values[i])}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sumbu Y kanan */}
          <div className="flex h-56 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums">
            {yTicks.map((t) => (
              <span key={t} className="-my-1.5 leading-3">
                {formatNumber(t)}
              </span>
            ))}
          </div>
        </div>

        {/* Label hari */}
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-3" aria-hidden>
          <div className="grid grid-cols-7 gap-2.5 px-1 text-center text-xs sm:gap-5 sm:px-2">
            {days.map((d, i) => (
              <span
                key={d.date}
                className={cn(i === activeIdx ? 'font-semibold text-foreground' : 'text-muted-foreground')}
              >
                {d.dayShort}
              </span>
            ))}
          </div>
          <span className="w-6" />
        </div>
      </figure>

      {footer && <div className="border-t border-border/60 pt-4">{footer}</div>}
    </FramedCard>
  )
}
