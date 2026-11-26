import { Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { ABSENTEE_STATUS_LIST, ATTENDANCE_META } from '@/lib/enums'
import { getErrorMessage } from '@/lib/error-mapping'
import { useClasses, useStudents } from '@/lib/lookups'
import type { AbsenteeRow, AbsenteeStatus, AttendanceStatus, ISODate } from '@/types/entities'
import { useCreateAbsentee, useUpdateAbsentee } from '../queries'

const SELECT_CLS =
  'native-select h-9 w-full cursor-pointer appearance-none rounded-md border border-border/90 bg-card pr-8 pl-3 text-[13px] font-medium text-foreground shadow-2xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

const EDIT_STATUSES: AttendanceStatus[] = ['PRESENT', ...ABSENTEE_STATUS_LIST]

/**
 * Dialog "+ Catat Ketidakhadiran" (tambah) dan "Edit" (ubah status H/S/I/A/D/P & keterangan).
 */
export function AbsenteeFormDialog({
  open,
  onOpenChange,
  date,
  row,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: ISODate
  row: AbsenteeRow | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <AbsenteeFormBody
          key={row ? row.recordId : `create-${date}`}
          date={date}
          row={row}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function AbsenteeFormBody({
  date,
  row,
  onClose,
}: {
  date: ISODate
  row: AbsenteeRow | null
  onClose: () => void
}) {
  const isEdit = row !== null
  const classes = useClasses()
  const [classId, setClassId] = useState(row?.classId ?? '')
  const [studentId, setStudentId] = useState(row?.studentId ?? '')
  const [status, setStatus] = useState<AttendanceStatus>(row?.status ?? 'SICK')
  const [reason, setReason] = useState(row?.reason ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const students = useStudents({ classId, activeOnly: true }, { enabled: !isEdit && !!classId })
  const create = useCreateAbsentee()
  const update = useUpdateAbsentee()
  const idem = useIdempotencyKey()
  const pending = create.isPending || update.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!isEdit) {
      if (!classId) nextErrors.classId = 'Pilih kelas terlebih dahulu.'
      if (!studentId) nextErrors.studentId = 'Pilih siswa terlebih dahulu.'
    }
    if (reason.trim().length > 500) nextErrors.reason = 'Keterangan maksimal 500 karakter.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors({})

    try {
      if (isEdit && row) {
        const res = await update.mutateAsync({
          recordId: row.recordId,
          body: { status, reason: reason.trim() || null },
        })
        toast.success(
          res.removed
            ? `Status ${row.studentName} diubah menjadi Hadir.`
            : `Data ketidakhadiran ${row.studentName} diperbarui.`,
        )
      } else {
        await create.mutateAsync({
          body: {
            date,
            classId,
            studentId,
            status: status as AbsenteeStatus,
            reason: reason.trim() || null,
          },
          idempotencyKey: idem.key(),
        })
        idem.reset()
        toast.success('Ketidakhadiran siswa berhasil dicatat.')
      }
      onClose()
    } catch (err) {
      idem.reset()
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Status Siswa' : 'Catat Ketidakhadiran Siswa'}</DialogTitle>
        <DialogDescription>
          {isEdit && row
            ? `Perbarui status kehadiran atau keterangan untuk ${row.studentName} (${row.className}).`
            : 'Pilih kelas, siswa, dan status ketidakhadiran (Sakit, Izin, Alpa, Dispensasi, atau PKL).'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4" noValidate>
        {isEdit && row ? (
          <div className="rounded-lg border border-border/80 bg-muted/35 px-3.5 py-2.5 text-xs">
            <p className="font-semibold text-foreground">{row.studentName}</p>
            <p className="mt-0.5 text-muted-foreground">
              {row.className} · NIS {row.studentNis}
            </p>
          </div>
        ) : (
          <>
            <FormField label="Kelas" required error={errors.classId} id="abs-class">
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value)
                  setStudentId('')
                }}
                className={SELECT_CLS}
              >
                <option value="">Pilih kelas…</option>
                {(classes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Nama Siswa" required error={errors.studentId} id="abs-student">
              <select
                value={studentId}
                disabled={!classId || students.isPending}
                onChange={(e) => setStudentId(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">
                  {!classId
                    ? 'Pilih kelas terlebih dahulu…'
                    : students.isPending
                      ? 'Memuat daftar siswa…'
                      : 'Pilih siswa…'}
                </option>
                {(students.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.nis})
                  </option>
                ))}
              </select>
            </FormField>
          </>
        )}

        <FormField label="Status Kehadiran" required id="abs-status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
            className={SELECT_CLS}
          >
            {(isEdit ? EDIT_STATUSES : ABSENTEE_STATUS_LIST).map((code) => (
              <option key={code} value={code}>
                {ATTENDANCE_META[code].label} ({ATTENDANCE_META[code].short})
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Keterangan"
          hint={status === 'PRESENT' ? 'Status Hadir akan mengeluarkan siswa dari daftar tidak hadir.' : 'Opsional.'}
          error={errors.reason}
          id="abs-reason"
        >
          <Textarea
            id="abs-reason"
            rows={3}
            disabled={status === 'PRESENT'}
            value={status === 'PRESENT' ? '' : reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Mis. Surat izin keperluan keluarga atau surat keterangan sakit"
          />
        </FormField>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending}>
            {isEdit ? <Save /> : <Plus />}
            {pending ? 'Menyimpan…' : isEdit ? 'Simpan' : 'Catat'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
