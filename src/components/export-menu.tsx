import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/auth-context'
import type { QueryParams } from '@/lib/api-client'
import { getErrorMessage } from '@/lib/error-mapping'
import { exportFileName, exportReport } from '@/lib/export'

/**
 * Menu ekspor (PRD §13.2): XLSX/CSV lewat GET /reports/export mengikuti filter aktif;
 * PDF lewat tampilan cetak (window.print atau `printHref`).
 */
export function ExportMenu({
  report,
  filters,
  period,
  printHref,
  onPrint,
}: {
  /** slug laporan, mis. 'student-attendance' */
  report: string
  filters: QueryParams
  /** string periode untuk nama file, mis. '2026-11' atau '2026-11-01_2026-11-08' */
  period: string
  printHref?: string
  onPrint?: () => void
}) {
  const { can } = useAuth()
  const [busy, setBusy] = useState(false)
  if (!can('report:export')) {
    return onPrint || printHref ? (
      <Button variant="outline" onClick={() => (printHref ? window.open(printHref, '_blank') : onPrint?.())}>
        <Printer /> Cetak
      </Button>
    ) : null
  }
  const run = async (format: 'csv' | 'xlsx') => {
    setBusy(true)
    try {
      await exportReport(report, format, filters, exportFileName(report, period, format))
      toast.success('File berhasil diunduh.')
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy} className="no-print">
          <Download /> {busy ? 'Menyiapkan…' : 'Ekspor'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void run('xlsx')}>
          <FileSpreadsheet /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('csv')}>
          <FileText /> CSV (.csv)
        </DropdownMenuItem>
        {(printHref || onPrint) && (
          <DropdownMenuItem
            onSelect={() => (printHref ? window.open(printHref, '_blank') : onPrint?.())}
          >
            <Printer /> Cetak / PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
