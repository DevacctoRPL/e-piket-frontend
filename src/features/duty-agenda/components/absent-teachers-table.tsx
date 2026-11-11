import { CircleAlert } from 'lucide-react'
import { ToneBadge, StatusBadge } from '@/components/status-badge'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TEACHER_ATTENDANCE_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
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
      <div className="hidden overflow-hidden rounded-md border border-border/75 md:block">
        <Table>
          <caption className="sr-only">Guru tidak hadir</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4 text-center">No</TableHead>
              <TableHead>Nama guru</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Alasan</TableHead>
              <TableHead className="text-right">Jam terdampak</TableHead>
              <TableHead className="pr-4">Sudah digantikan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow
                key={r.teacherId}
                className={rowErrors[i] ? 'border-l-2 border-l-tone-danger' : undefined}
              >
                <TableCell className="pl-4 text-center text-muted-foreground tabular-nums">{i + 1}</TableCell>
                <TableCell className="font-medium">{r.teacherName}</TableCell>
                <TableCell>
                  <StatusBadge meta={TEACHER_ATTENDANCE_META} value={r.status} />
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal">
                  {r.reason ? (
                    r.reason
                  ) : (
                    <MissingReason required={!!rowErrors[i]} />
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.affectedPeriods}</TableCell>
                <TableCell className="pr-4">
                  <ToneBadge tone={handledTone(r)}>{handledLabel(r)}</ToneBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="pl-4 font-semibold">
                Jumlah
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{total.affected}</TableCell>
              <TableCell className="pr-4 text-xs text-muted-foreground tabular-nums">
                {total.handled} jam digantikan · {total.unhandled} belum
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Ponsel */}
      <ul className="grid gap-2 md:hidden" aria-label="Guru tidak hadir">
        {rows.map((r, i) => (
          <li
            key={r.teacherId}
            className={cn(
              'rounded-md border border-border/75 bg-card p-3',
              rowErrors[i] && 'border-l-2 border-l-tone-danger',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 font-medium">{r.teacherName}</p>
              <StatusBadge meta={TEACHER_ATTENDANCE_META} value={r.status} />
            </div>
            <p className="mt-1 text-sm">
              {r.reason ? (
                <span className="text-muted-foreground">{r.reason}</span>
              ) : (
                <MissingReason required={!!rowErrors[i]} />
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="tabular-nums text-muted-foreground">{r.affectedPeriods} jam terdampak</span>
              <ToneBadge tone={handledTone(r)}>Digantikan: {handledLabel(r)}</ToneBadge>
            </div>
          </li>
        ))}
        <li className="flex justify-between gap-2 px-1 pt-1 text-xs text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">Jumlah {total.affected} jam</span>
          <span>
            {total.handled} digantikan · {total.unhandled} belum
          </span>
        </li>
      </ul>
    </>
  )
}

/** Alasan kosong: ikon + teks (merah hanya pada ikon kecuali wajib diisi). */
function MissingReason({ required }: { required: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', required ? 'text-tone-danger' : 'text-foreground/85')}>
      <CircleAlert className="size-3.5 shrink-0 text-tone-danger" aria-hidden />
      {required ? 'Alasan wajib diisi' : 'Belum ada alasan'}
    </span>
  )
}
