import { PrintDocument, PrintTable } from '@/components/print-layout'
import { formatDateLong, formatWallTime } from '@/lib/date'
import { ATTENDANCE_META, EXTRA_ACTIVITY_TYPE_META } from '@/lib/enums'
import type { AttendanceStatus, ExtraActivity } from '@/types/entities'

/**
 * Tampilan cetak menyerupai formulir buku "AGENDA KURSUS/JAM TAMBAHAN" (PRD §2, §13.1):
 * kolom Shift, No, Nama/Kegiatan, Kelas, Materi, Keterangan — lalu daftar hadir peserta bila ada.
 */
export function ActivityPrint({ activity: a, shiftName }: { activity: ExtraActivity; shiftName: string }) {
  const counts = (s: AttendanceStatus) => a.participants.filter((p) => p.status === s).length
  return (
    <PrintDocument
      title="Agenda Kursus / Jam Tambahan"
      meta={[
        ['Hari/Tanggal', formatDateLong(a.date)],
        ['Shift', shiftName],
        ['Waktu', a.startTime ? `${formatWallTime(a.startTime)} – ${formatWallTime(a.endTime)}` : '—'],
        ['Jenis', EXTRA_ACTIVITY_TYPE_META[a.type].label],
        ['Pengampu', a.instructorName],
      ]}
      signatures={[
        { role: 'Koordinator Kegiatan' },
        { role: 'Pengampu', name: a.instructorName },
      ]}
    >
      <PrintTable>
        <thead>
          <tr>
            <th className="w-16">Shift</th>
            <th className="w-8">No</th>
            <th>Nama / Kegiatan</th>
            <th className="w-32">Kelas</th>
            <th>Materi</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="text-center">{shiftName}</td>
            <td className="text-center">1</td>
            <td>{a.name}</td>
            <td>{a.classNames.join(', ')}</td>
            <td>{a.topic ?? ''}</td>
            <td>{a.note ?? ''}</td>
          </tr>
        </tbody>
      </PrintTable>

      {a.participantAttendanceEnabled && a.participants.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold">Daftar Hadir Peserta</h2>
          <PrintTable>
            <thead>
              <tr>
                <th className="w-8">No</th>
                <th>Nama Siswa</th>
                <th className="w-28">Kelas</th>
                <th className="w-10">H</th>
                <th className="w-10">S</th>
                <th className="w-10">I</th>
                <th className="w-10">A</th>
              </tr>
            </thead>
            <tbody>
              {a.participants.map((p, i) => {
                const cls = a.classNames[a.classIds.indexOf(p.classId)] ?? ''
                const mark = (s: AttendanceStatus) => (p.status === s ? '✓' : '')
                return (
                  <tr key={p.studentId}>
                    <td className="text-center">{i + 1}</td>
                    <td>
                      {p.studentName}
                      {!['PRESENT', 'SICK', 'PERMISSION', 'ABSENT'].includes(p.status) && ` (${ATTENDANCE_META[p.status].label})`}
                    </td>
                    <td>{cls}</td>
                    <td className="text-center">{mark('PRESENT')}</td>
                    <td className="text-center">{mark('SICK')}</td>
                    <td className="text-center">{mark('PERMISSION')}</td>
                    <td className="text-center">{mark('ABSENT')}</td>
                  </tr>
                )
              })}
              <tr>
                <td colSpan={3} className="text-right font-semibold">
                  Jumlah ({a.participants.length} peserta)
                </td>
                <td className="text-center font-semibold">{counts('PRESENT')}</td>
                <td className="text-center font-semibold">{counts('SICK')}</td>
                <td className="text-center font-semibold">{counts('PERMISSION')}</td>
                <td className="text-center font-semibold">{counts('ABSENT')}</td>
              </tr>
            </tbody>
          </PrintTable>
        </section>
      )}
    </PrintDocument>
  )
}
