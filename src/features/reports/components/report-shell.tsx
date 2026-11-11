import type { UseQueryResult } from '@tanstack/react-query'
import { FULL_SCOPE_ROLES } from '@/lib/permissions'
import { ArrowLeft, CalendarRange, Info, Loader2, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { DataTable } from '@/components/data-table'
import { ExportMenu } from '@/components/export-menu'
import { PrintButton, PrintDocument } from '@/components/print-layout'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton, CardsSkeleton } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/auth-context'
import { useLookupMaps, useSettings } from '@/features/master-data/lookups'
import { formatDateTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { ReportDef } from '../catalog'
import type { ReportFilters } from '../lib/use-report-filters'
import { ReportFilterBar, type ReportFilterConfig } from './report-filter-bar'

interface ReportData {
  generatedAt: string
}

export interface ReportViewProps<T extends ReportData> {
  def: ReportDef
  filters: ReportFilters
  filterConfig: ReportFilterConfig
  query: UseQueryResult<T>
  mode: 'screen' | 'print'
  /** Kartu ringkasan (angka server). */
  summary: (data: T) => ReactNode
  /** Isi utama di layar (tabel). */
  content: (data: T) => ReactNode
  /** Isi dokumen cetak. */
  print: (data: T) => ReactNode
  /** Baris meta tambahan untuk dokumen cetak (selain Periode & Filter). */
  printMeta?: (data: T) => [string, ReactNode][]
  /** Tautan ke halaman operasional. */
  operationalLink?: { label: string; href: string }
  /** Catatan aturan perhitungan. */
  note?: ReactNode
}

/** Bingkai laporan: layar (filter + ringkasan + tabel) atau dokumen cetak dari data yang sama. */
export function ReportView<T extends ReportData>(props: ReportViewProps<T>) {
  return props.mode === 'print' ? <ReportPrint {...props} /> : <ReportScreen {...props} />
}

/** Ringkasan filter aktif untuk dokumen cetak (nama siswa tidak ditampilkan di URL, hanya di dokumen). */
function useFilterText(filters: ReportFilters, config: ReportFilterConfig) {
  const maps = useLookupMaps()
  const v = filters.values
  const parts: string[] = []
  if (v.classId) parts.push(`Kelas ${maps.classById.get(v.classId)?.name ?? '—'}`)
  if (v.shiftCode) parts.push(`Shift ${maps.shiftName(v.shiftCode)}`)
  if (v.teacherId) parts.push(`Guru ${maps.teacherById.get(v.teacherId)?.name ?? '—'}`)
  if (v.subjectId) parts.push(`Mapel ${maps.subjectById.get(v.subjectId)?.name ?? '—'}`)
  if (v.studentId) parts.push('Satu siswa')
  if (v.status) parts.push(`Status ${config.status?.options.find((o) => o.value === v.status)?.label ?? v.status}`)
  if (v.type) parts.push(`Jenis ${config.type?.options.find((o) => o.value === v.type)?.label ?? v.type}`)
  return parts.join(' · ')
}

function useScopeNotice() {
  const { is } = useAuth()
  if (is(...FULL_SCOPE_ROLES)) return null
  if (is('HOMEROOM')) return 'Data dibatasi pada kelas binaan dan kelas yang Anda ajar.'
  return 'Data dibatasi pada data pribadi Anda dan kelas yang Anda ajar.'
}

function ReportScreen<T extends ReportData>({
  def,
  filters,
  filterConfig,
  query,
  summary,
  content,
  operationalLink,
  note,
}: ReportViewProps<T>) {
  const location = useLocation()
  const scopeNotice = useScopeNotice()
  const printHref = `/laporan/${def.path}/cetak${location.search}`
  return (
    <Page>
      <div className="no-print -mb-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/laporan">
            <ArrowLeft /> Semua laporan
          </Link>
        </Button>
      </div>
      <PageHeader
        title={def.title}
        description={def.description}
        actions={
          <>
            {operationalLink && (
              <Button asChild variant="ghost">
                <Link to={operationalLink.href}>{operationalLink.label}</Link>
              </Button>
            )}
            {filters.query && (
              <ExportMenu
                report={def.slug}
                filters={filters.exportFilters}
                period={filters.periodFile}
                printHref={printHref}
              />
            )}
          </>
        }
      />
      <ReportFilterBar filters={filters} config={filterConfig} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground" aria-live="polite">
        <span className="inline-flex items-center gap-1.5">
          <CalendarRange className="size-3.5" />
          Periode: <span className="font-medium text-foreground">{filters.periodText}</span>
        </span>
        {query.data && (
          <span className="tabular-nums">Dibuat {formatDateTime(query.data.generatedAt)}</span>
        )}
        {query.isFetching && !query.isPending && (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="size-3.5 animate-spin" /> Memperbarui…
          </span>
        )}
      </div>

      {scopeNotice && (
        <Alert variant="info">
          <ShieldCheck />
          <AlertDescription>{scopeNotice}</AlertDescription>
        </Alert>
      )}

      {filters.rangeError ? (
        <EmptyState
          title="Rentang tanggal tidak valid"
          description={`${filters.rangeError} Ubah tanggal pada filter periode.`}
          icon={<CalendarRange className="size-5" />}
        />
      ) : query.isPending ? (
        <div className="space-y-5">
          <CardsSkeleton count={4} />
          <TableSkeleton />
        </div>
      ) : query.isError || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className={cn('space-y-5 transition-opacity', query.isPlaceholderData && 'opacity-60')}>
          {summary(query.data)}
          {content(query.data)}
        </div>
      )}

      {note && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>{note}</span>
        </p>
      )}
    </Page>
  )
}

function ReportPrint<T extends ReportData>({ def, filters, filterConfig, query, print, printMeta }: ReportViewProps<T>) {
  const filterText = useFilterText(filters, filterConfig)
  const location = useLocation()
  const { user } = useAuth()
  const settings = useSettings()
  const backHref = `/laporan/${def.path}${location.search}`
  return (
    <div className="space-y-4">
      <div className="no-print mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={backHref}>
            <ArrowLeft /> Kembali ke laporan
          </Link>
        </Button>
        <PrintButton />
      </div>
      {filters.rangeError ? (
        <EmptyState title="Rentang tanggal tidak valid" description={filters.rangeError} />
      ) : query.isPending ? (
        <TableSkeleton />
      ) : query.isError || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <PrintDocument
          title={def.title}
          subtitle={settings.data?.schoolName}
          meta={[
            ['Periode', filters.periodText],
            ['Filter', filterText || 'Semua'],
            ...(printMeta?.(query.data) ?? []),
            ['Dibuat pada', formatDateTime(query.data.generatedAt)],
          ]}
          signatures={[
            { role: 'Dibuat oleh', name: user?.name ?? null },
            {
              role: 'Mengetahui, Kepala Sekolah',
              name: settings.data?.principalName ?? null,
              nip: settings.data?.principalNip ?? null,
            },
          ]}
        >
          {print(query.data)}
        </PrintDocument>
      )}
    </div>
  )
}

/** Baris total (angka server) — dipakai sebagai footer tabel & kartu di ponsel. */
export function TotalsBar({ items, label = 'Total', className }: { items: [string, ReactNode][]; label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-6 gap-y-1.5 text-[13px]', className)} aria-label={label}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {items.map(([k, v]) => (
        <span key={k} className="inline-flex items-baseline gap-1.5">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-semibold tabular-nums">{v}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * DataTable berbingkai (FramedCard: ikon + judul + jumlah baris) + baris total yang tampil di desktop
 * (footer tabel) maupun ponsel (kartu). `description` tampil sebagai teks kecil di kanan header.
 */
export function ReportTable<T>({
  totals,
  totalsLabel,
  description,
  toolbar,
  ...props
}: React.ComponentProps<typeof DataTable<T>> & {
  totals?: [string, ReactNode][]
  totalsLabel?: string
  description?: ReactNode
}) {
  return (
    <div className="space-y-2">
      <DataTable<T>
        {...props}
        toolbar={
          toolbar ?? (description ? <span className="text-xs text-muted-foreground">{description}</span> : undefined)
        }
        footer={
          totals ? (
            <TotalsBar items={totals} label={totalsLabel} className="border-t border-border/60 bg-muted/40 px-4 py-2.5" />
          ) : undefined
        }
      />
      {totals && props.data.length > 0 && (
        <TotalsBar
          items={totals}
          label={totalsLabel}
          className="rounded-lg border border-border/85 bg-card p-3 shadow-2xs md:hidden"
        />
      )}
    </div>
  )
}

/** Kisi kartu ringkasan. */
export function SummaryGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
}
