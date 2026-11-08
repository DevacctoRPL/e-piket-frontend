import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ErrorState, Page } from '@/components/page'
import { PrintButton, PrintDocument, PrintTable } from '@/components/print-layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useLookupMaps, useSettings } from '@/features/master-data/lookups'
import { formatDateLong, formatDateTime, formatTime } from '@/lib/date'
import { RECORD_STATUS_META, TEACHER_ATTENDANCE_META } from '@/lib/enums'
import { handledLabel, summarizeAbsent } from '../components/agenda-bits'
import { useDutyAgenda } from '../queries'

/** Cetak "Agenda Kegiatan Sekolah / Guru Piket" menyerupai buku (FR-DUTY-06, PRD §13.1). */
export function DutyAgendaPrintPage() {
  const { id = '' } = useParams()
  const query = useDutyAgenda(id)
  const settings = useSettings()
  const { shiftName } = useLookupMaps()

  return (
    <Page className="gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/agenda-piket/${encodeURIComponent(id)}`}>
            <ArrowLeft /> Kembali ke agenda
          </Link>
        </Button>
        {query.data && <PrintButton />}
      </div>

      {query.isPending ? (
        <Skeleton className="mx-auto h-[60vh] w-full max-w-[210mm] rounded-none" aria-label="Memuat dokumen" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        (() => {
          const a = query.data
          const totals = summarizeAbsent(a.absentTeachers)
          return (
            <>
              {a.status !== 'FINAL' && (
                <p className="no-print rounded-lg border border-tone-warning/30 bg-tone-warning-bg px-3 py-2 text-sm text-tone-warning">
                  Agenda belum final (status: {RECORD_STATUS_META[a.status].label}). Hasil cetak dapat berubah.
                </p>
              )}
              <PrintDocument
                title="Agenda Kegiatan Sekolah / Guru Piket"
                documentDate={a.date}
                meta={[
                  ['Hari/Tanggal', formatDateLong(a.date)],
                  ['Shift', shiftName(a.shiftCode)],
                  ['Guru Piket', a.dutyTeacherNames.join(', ') || '—'],
                  ['Status', `${RECORD_STATUS_META[a.status].label}${a.finalizedAt ? ` (${formatDateTime(a.finalizedAt)})` : ''}`],
                ]}
                signatures={[
                  ...a.dutyTeacherNames.map((name) => ({ role: 'Guru Piket', name })),
                  {
                    role: 'Kepala Sekolah',
                    name: settings.data?.principalName ?? null,
                    nip: settings.data?.principalNip ?? null,
                  },
                ]}
              >
                <section className="break-inside-avoid">
                  <h2 className="mb-1 font-bold">A. Daftar Guru yang Harus Hadir</h2>
                  <PrintTable>
                    <thead>
                      <tr>
                        <th>Guru Terjadwal</th>
                        <th>Hadir</th>
                        <th>Tidak Hadir</th>
                        <th>Belum Tercatat</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-center tabular-nums">
                        <td>{a.scheduledTeacherCount}</td>
                        <td>{a.presentTeacherCount}</td>
                        <td>{a.absentTeachers.length}</td>
                        <td>
                          {Math.max(0, a.scheduledTeacherCount - a.presentTeacherCount - a.absentTeachers.length)}
                        </td>
                      </tr>
                    </tbody>
                  </PrintTable>
                </section>

                <section>
                  <h2 className="mb-1 font-bold">B. Guru Tidak Hadir</h2>
                  <PrintTable>
                    <thead>
                      <tr>
                        <th className="w-8">No</th>
                        <th>Nama Guru</th>
                        <th>Keterangan</th>
                        <th>Alasan</th>
                        <th className="w-16">Jumlah Jam</th>
                        <th>Digantikan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.absentTeachers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center italic">
                            {a.noAbsentTeachers ? 'Nihil — tidak ada guru yang tidak hadir' : '—'}
                          </td>
                        </tr>
                      ) : (
                        a.absentTeachers.map((r, i) => (
                          <tr key={r.teacherId}>
                            <td className="text-center">{i + 1}</td>
                            <td>{r.teacherName}</td>
                            <td className="text-center">
                              {TEACHER_ATTENDANCE_META[r.status].short} · {TEACHER_ATTENDANCE_META[r.status].label}
                            </td>
                            <td>{r.reason ?? '—'}</td>
                            <td className="text-center tabular-nums">{r.affectedPeriods}</td>
                            <td className="text-center">{handledLabel(r)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {a.absentTeachers.length > 0 && (
                      <tfoot>
                        <tr className="font-semibold">
                          <td colSpan={4} className="text-right">
                            Jumlah
                          </td>
                          <td className="text-center tabular-nums">{totals.affected}</td>
                          <td className="text-center tabular-nums">{totals.handled} jam</td>
                        </tr>
                      </tfoot>
                    )}
                  </PrintTable>
                </section>

                <section>
                  <h2 className="mb-1 font-bold">C. Hal Penting / Kejadian</h2>
                  <PrintTable>
                    <thead>
                      <tr>
                        <th className="w-8">No</th>
                        <th className="w-14">Jam</th>
                        <th className="w-24">Kategori</th>
                        <th>Uraian</th>
                        <th className="w-32">Pencatat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.notes.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center italic">
                            {a.noImportantNotes ? 'Nihil — tidak ada catatan hal penting' : '—'}
                          </td>
                        </tr>
                      ) : (
                        a.notes.map((n, i) => (
                          <tr key={n.id}>
                            <td className="text-center">{i + 1}</td>
                            <td className="text-center tabular-nums">{formatTime(n.time)}</td>
                            <td>{n.category ?? '—'}</td>
                            <td className="whitespace-pre-line">{n.content}</td>
                            <td>{n.createdByName}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </PrintTable>
                </section>

                <section className="break-inside-avoid">
                  <h2 className="mb-1 font-bold">D. Penanggulangan Jam Kosong</h2>
                  <PrintTable>
                    <tbody>
                      <tr>
                        <td className="w-48">Jam terdampak</td>
                        <td className="tabular-nums">{totals.affected} jam</td>
                      </tr>
                      <tr>
                        <td>Sudah digantikan</td>
                        <td className="tabular-nums">{totals.handled} jam</td>
                      </tr>
                      <tr>
                        <td>Belum tertangani</td>
                        <td className="tabular-nums">{totals.unhandled} jam</td>
                      </tr>
                      <tr>
                        <td className="align-top">Keterangan</td>
                        <td className="min-h-12 whitespace-pre-line">{a.substitutionSummary || '—'}</td>
                      </tr>
                    </tbody>
                  </PrintTable>
                </section>
              </PrintDocument>
            </>
          )
        })()
      )}
    </Page>
  )
}
