import { ArrowLeft } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { ErrorState, TableSkeleton } from '@/components/page'
import { PrintButton, PrintDocument, PrintTable } from '@/components/print-layout'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/misc'
import { useCurrentUser } from '@/features/auth/auth-context'
import { useClasses, useShifts } from '@/features/master-data/lookups'
import { formatDate, formatDateLong } from '@/lib/date'
import { ATTENDANCE_META, NON_PRESENT_STATUSES } from '@/lib/enums'
import type { AbsenteeRow, AttendanceStatus } from '@/types/entities'
import { PRINT_PAGE_SIZE, useAbsenteesForPrint } from '../queries'
import { useAbsenteeFilters, useShiftName } from '../use-absentee-filters'

/** Isi kolom "Keterangan" pada formulir buku: alasan + catatan konfirmasi. */
function keterangan(r: AbsenteeRow) {
  return [r.reason, r.note, r.contact?.contactNote].filter(Boolean).join('; ')
}

/** Tampilan cetak "DAFTAR SISWA YANG TIDAK HADIR" mengikuti filter yang sama dengan halaman daftar. */
export function AbsenteesPrintPage() {
  const user = useCurrentUser()
  const [sp] = useSearchParams()
  const { baseQuery } = useAbsenteeFilters()
  const query = useAbsenteesForPrint(baseQuery)
  const classes = useClasses({ scope: 'mine' })
  const shifts = useShifts()
  const shiftName = useShiftName(shifts.data)

  const backHref = `/siswa-tidak-hadir${sp.toString() ? `?${sp.toString()}` : ''}`
  const multiDay = baseQuery.dateFrom !== baseQuery.dateTo
  const className = baseQuery.classId
    ? (classes.data?.find((c) => c.id === baseQuery.classId)?.name ?? '…')
    : 'Semua kelas'
  const statusText =
    baseQuery.status && baseQuery.status.length > 0
      ? baseQuery.status.map((s) => ATTENDANCE_META[s].label).join(', ')
      : 'Semua status tidak hadir'

  const rows = query.data?.data ?? []
  const truncated = (query.data?.meta.totalItems ?? 0) > rows.length
  const counts = NON_PRESENT_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length] as [AttendanceStatus, number]).filter(
    ([, n]) => n > 0,
  )

  return (
    <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-4 print:max-w-none">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost">
          <Link to={backHref}>
            <ArrowLeft /> Kembali ke daftar
          </Link>
        </Button>
        <PrintButton />
      </div>

      {truncated && (
        <Alert variant="warning" className="no-print">
          <AlertDescription>
            Data melebihi {PRINT_PAGE_SIZE} baris; hanya {PRINT_PAGE_SIZE} baris pertama yang dicetak. Persempit rentang tanggal
            atau gunakan ekspor Excel.
          </AlertDescription>
        </Alert>
      )}

      {query.isPending ? (
        <TableSkeleton rows={8} cols={7} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <PrintDocument
          title="Daftar Siswa yang Tidak Hadir"
          meta={[
            ['Hari/Tanggal', multiDay ? `${formatDate(baseQuery.dateFrom)} s.d. ${formatDate(baseQuery.dateTo)}` : formatDateLong(baseQuery.dateFrom)],
            ['Shift', baseQuery.shiftCode ? shiftName(baseQuery.shiftCode) : 'Semua shift'],
            ['Kelas', className],
            ['Status', statusText],
          ]}
          signatures={[{ role: 'Petugas Piket', name: user.name }]}
        >
          <PrintTable>
            <thead>
              <tr>
                <th className="w-8">No</th>
                {multiDay && <th>Tanggal</th>}
                <th>Nama Siswa</th>
                <th>Kelas</th>
                <th className="w-16">Status (S/I/A)</th>
                <th>No. Telp</th>
                <th>Yang Menerima</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={multiDay ? 8 : 7} className="py-4 text-center italic">
                    Tidak ada siswa tidak hadir pada periode ini.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.recordId}>
                    <td className="text-center tabular-nums">{i + 1}</td>
                    {multiDay && <td className="whitespace-nowrap">{formatDate(r.date)}</td>}
                    <td>{r.studentName}</td>
                    <td className="whitespace-nowrap">{r.className}</td>
                    <td className="text-center font-semibold" title={ATTENDANCE_META[r.status].label}>
                      {ATTENDANCE_META[r.status].short ?? ATTENDANCE_META[r.status].label}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">{r.contact?.contactedPhone ?? r.guardianPhone ?? ''}</td>
                    <td>{r.contact?.receiverName ?? ''}</td>
                    <td>{keterangan(r)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </PrintTable>
          <p className="text-xs">
            Jumlah: <strong className="tabular-nums">{rows.length}</strong> siswa
            {counts.length > 0 && (
              <>
                {' ('}
                {counts.map(([s, n]) => `${ATTENDANCE_META[s].short ?? ''} ${ATTENDANCE_META[s].label}: ${n}`).join(', ')}
                {')'}
              </>
            )}
            . Keterangan status: S = Sakit, I = Izin, A = Alpa, T = Terlambat, PA = Pulang Lebih Awal, D = Dispensasi.
          </p>
        </PrintDocument>
      )}
    </div>
  )
}
