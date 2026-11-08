import { ToneBadge, StatusBadge } from '@/components/status-badge'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TEACHER_ATTENDANCE_META } from '@/lib/enums'
import type { DutyAbsentTeacherRow } from '@/types/entities'
import { handledLabel, handledTone, summarizeAbsent } from './agenda-bits'

/** Tabel guru tidak hadir: Nama, Status, Alasan, Jam terdampak, Sudah digantikan (FR-DUTY-03). */
export function AbsentTeachersTable({
  rows,
  rowErrors = {},
}: {
  rows: DutyAbsentTeacherRow[]
  rowErrors?: Record<number, string>
}) {
  const total = summarizeAbsent(rows)
  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <caption className="sr-only">Guru tidak hadir</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-center">No</TableHead>
              <TableHead>Nama Guru</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Alasan</TableHead>
              <TableHead className="text-right">Jam Terdampak</TableHead>
              <TableHead>Sudah Digantikan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.teacherId}>
                <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                <TableCell className="font-medium">{r.teacherName}</TableCell>
                <TableCell>
                  <StatusBadge meta={TEACHER_ATTENDANCE_META} value={r.status} />
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal">
                  {r.reason ? (
                    r.reason
                  ) : (
                    <span className="text-sm font-medium text-tone-danger">
                      {rowErrors[i] ? 'Alasan wajib diisi' : 'Belum ada alasan'}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.affectedPeriods}</TableCell>
                <TableCell>
                  <ToneBadge tone={handledTone(r)}>{handledLabel(r)}</ToneBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="font-semibold">
                Jumlah
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{total.affected}</TableCell>
              <TableCell className="text-sm tabular-nums">
                {total.handled} jam digantikan · {total.unhandled} belum
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Ponsel */}
      <ul className="grid gap-2 md:hidden" aria-label="Guru tidak hadir">
        {rows.map((r, i) => (
          <li key={r.teacherId} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 font-medium">{r.teacherName}</p>
              <StatusBadge meta={TEACHER_ATTENDANCE_META} value={r.status} />
            </div>
            <p className="mt-1 text-sm">
              {r.reason ? (
                <span className="text-muted-foreground">{r.reason}</span>
              ) : (
                <span className="font-medium text-tone-danger">
                  {rowErrors[i] ? 'Alasan wajib diisi' : 'Belum ada alasan'}
                </span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="tabular-nums text-muted-foreground">{r.affectedPeriods} jam terdampak</span>
              <ToneBadge tone={handledTone(r)}>Digantikan: {handledLabel(r)}</ToneBadge>
            </div>
          </li>
        ))}
        <li className="flex justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm font-medium tabular-nums">
          <span>Jumlah {total.affected} jam</span>
          <span>{total.handled} digantikan · {total.unhandled} belum</span>
        </li>
      </ul>
    </>
  )
}
