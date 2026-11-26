import { Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { FormField } from '@/components/form-field'
import { TeacherCombobox, type TeacherComboboxValue } from '@/components/teacher-combobox'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { getErrorMessage } from '@/lib/error-mapping'
import { useClasses, useSubjects, useTeachers } from '@/lib/lookups'
import type { ISODate, SubstitutionSlot } from '@/types/entities'
import {
  useAssignSubstitute,
  useCreateManualEmptySlot,
  useUpdateManualEmptySlot,
  useUpdateSubstitute,
} from '../queries'

const SELECT_CLS =
  'native-select h-9 w-full cursor-pointer appearance-none rounded-md border border-border/90 bg-card pr-8 pl-3 text-[13px] font-medium text-foreground shadow-2xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * Dialog "+ Tambah" pada kartu Jam Kosong:
 * - Mendukung pilihan cepat (quick-pick) dari jadwal guru tidak hadir hari ini yang belum punya pengganti
 * - Mendukung input manual penuh
 * - Guru Piket / Pengganti wajib diisi pada kedua mode
 */
export function AddEmptySlotDialog({
  date,
  unhandledSlots,
  open,
  onOpenChange,
}: {
  date: ISODate
  unhandledSlots: SubstitutionSlot[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const classes = useClasses()
  const subjects = useSubjects()
  const teachers = useTeachers()
  const create = useCreateManualEmptySlot()
  const assign = useAssignSubstitute()
  const idem = useIdempotencyKey()

  const [sourceSlotId, setSourceSlotId] = useState<string>('manual')
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [periodStart, setPeriodStart] = useState('1')
  const [periodEnd, setPeriodEnd] = useState('2')
  const [absentTeacher, setAbsentTeacher] = useState<TeacherComboboxValue>({ teacherId: null, name: '' })
  const [dutyTeacher, setDutyTeacher] = useState<TeacherComboboxValue>({ teacherId: null, name: '' })
  const [activity, setActivity] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const selectedSlot = unhandledSlots.find((s) => s.id === sourceSlotId) ?? null
  const pending = create.isPending || assign.isPending

  const resetForm = () => {
    setSourceSlotId('manual')
    setClassId('')
    setSubjectId('')
    setPeriodStart('1')
    setPeriodEnd('2')
    setAbsentTeacher({ teacherId: null, name: '' })
    setDutyTeacher({ teacherId: null, name: '' })
    setActivity('')
    setErrors({})
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const handleSourceChange = (nextSourceId: string) => {
    setSourceSlotId(nextSourceId)
    setErrors({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: Record<string, string> = {}

    if (!dutyTeacher.name.trim()) {
      nextErrors.substituteTeacherName = 'Nama guru piket/pengganti wajib diisi.'
    }

    if (selectedSlot) {
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors)
        return
      }
      setErrors({})
      try {
        await assign.mutateAsync({
          body: {
            date,
            timetableSlotId: selectedSlot.timetableSlotId,
            substituteTeacherId: dutyTeacher.teacherId,
            substituteTeacherName: dutyTeacher.name.trim(),
            activity: activity.trim() || null,
          },
          idempotencyKey: idem.key(),
        })
        idem.reset()
        toast.success('Guru pengganti berhasil ditambahkan.')
        handleOpenChange(false)
      } catch (err) {
        idem.reset()
        toast.error(getErrorMessage(err))
      }
      return
    }

    const ps = Number(periodStart)
    const pe = Number(periodEnd)
    if (!classId) nextErrors.classId = 'Pilih kelas terlebih dahulu.'
    if (!Number.isInteger(ps) || ps < 1 || ps > 12) nextErrors.periodStart = 'Jam mulai 1–12.'
    if (!Number.isInteger(pe) || pe < 1 || pe > 12) nextErrors.periodEnd = 'Jam selesai 1–12.'
    else if (!nextErrors.periodStart && pe < ps) nextErrors.periodEnd = 'Jam selesai tidak boleh sebelum jam mulai.'
    if (!absentTeacher.name.trim()) nextErrors.absentTeacherName = 'Nama guru tidak hadir wajib diisi.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors({})
    try {
      await create.mutateAsync({
        body: {
          date,
          classId,
          subjectId: subjectId || null,
          periodStart: ps,
          periodEnd: pe,
          absentTeacherId: absentTeacher.teacherId,
          absentTeacherName: absentTeacher.name.trim(),
          substituteTeacherId: dutyTeacher.teacherId,
          substituteTeacherName: dutyTeacher.name.trim(),
          activity: activity.trim() || null,
        },
        idempotencyKey: idem.key(),
      })
      idem.reset()
      toast.success('Jam kosong berhasil ditambahkan.')
      handleOpenChange(false)
    } catch (err) {
      idem.reset()
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Jam Kosong</DialogTitle>
          <DialogDescription>
            Pilih jadwal guru tidak hadir hari ini atau catat jadwal baru, lalu tentukan guru piket penggantinya.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4" noValidate>
          {unhandledSlots.length > 0 && (
            <FormField
              label="Sumber Jadwal"
              hint="Pilih jadwal guru tidak hadir agar data terisi otomatis, atau pilih input manual."
              id="add-slot-source"
            >
              <select
                value={selectedSlot ? selectedSlot.id : 'manual'}
                onChange={(e) => handleSourceChange(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="manual">Input manual (jadwal baru)</option>
                {unhandledSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {`${slot.className} · Jam ke-${slot.periodStart}–${slot.periodEnd} · ${slot.subjectName} (${slot.absentTeacherName})`}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          {selectedSlot ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border/80 bg-muted/35 px-3.5 py-3 text-xs">
              <dt className="text-muted-foreground">Kelas</dt>
              <dd className="font-semibold text-foreground">{selectedSlot.className}</dd>
              <dt className="text-muted-foreground">Mata Pelajaran</dt>
              <dd className="font-medium text-foreground">{selectedSlot.subjectName}</dd>
              <dt className="text-muted-foreground">Jam Ke-</dt>
              <dd className="font-medium text-foreground tabular-nums">
                Jam ke-{selectedSlot.periodStart}–{selectedSlot.periodEnd}
              </dd>
              <dt className="text-muted-foreground">Guru Tidak Hadir</dt>
              <dd className="font-medium text-foreground">{selectedSlot.absentTeacherName}</dd>
            </dl>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Kelas" required error={errors.classId} id="add-slot-class">
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
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
                <FormField label="Mata Pelajaran" id="add-slot-subject">
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className={SELECT_CLS}
                  >
                    <option value="">Pilih mapel (opsional)…</option>
                    {(subjects.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Jam Ke- Mulai" required error={errors.periodStart} id="add-slot-ps">
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </FormField>
                <FormField label="Jam Ke- Selesai" required error={errors.periodEnd} id="add-slot-pe">
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </FormField>
              </div>

              <FormField
                label="Guru Tidak Hadir"
                required
                error={errors.absentTeacherName}
                id="add-slot-absent"
              >
                <TeacherCombobox
                  ariaLabel="Guru Tidak Hadir"
                  teachers={teachers.data ?? []}
                  value={absentTeacher}
                  onChange={setAbsentTeacher}
                  placeholder="Pilih atau ketik nama guru yang tidak hadir…"
                />
              </FormField>
            </>
          )}

          <FormField
            label="Guru Piket / Pengganti"
            required
            error={errors.substituteTeacherName}
            hint="Wajib diisi. Pilih dari daftar guru atau ketik nama bebas."
            id="add-slot-duty"
          >
            <TeacherCombobox
              ariaLabel="Guru Piket / Pengganti"
              teachers={teachers.data ?? []}
              value={dutyTeacher}
              onChange={setDutyTeacher}
              placeholder="Pilih atau ketik nama guru piket…"
            />
          </FormField>

          <FormField label="Kegiatan / Catatan" id="add-slot-activity">
            <Textarea
              id="add-slot-activity"
              rows={2}
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="Mis. Mengerjakan latihan soal dari guru mapel"
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              <Plus /> {pending ? 'Menambahkan…' : 'Tambah'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Dialog Edit pada baris Jam Kosong:
 * - Slot otomatis: ubah Guru Piket/Pengganti (wajib) & catatan kegiatan.
 * - Slot manual: ubah detail kelas/jam/mapel/guru tidak hadir sekaligus Guru Piket (wajib).
 */
export function EditEmptySlotDialog({
  slot,
  onOpenChange,
}: {
  slot: SubstitutionSlot | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={slot !== null} onOpenChange={onOpenChange}>
      {slot && <EditEmptySlotForm key={slot.id} slot={slot} onClose={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function EditEmptySlotForm({ slot, onClose }: { slot: SubstitutionSlot; onClose: () => void }) {
  const classes = useClasses()
  const subjects = useSubjects()
  const teachers = useTeachers()
  const updateSub = useUpdateSubstitute()
  const updateManual = useUpdateManualEmptySlot()

  const isManual = !!slot.isManual && !!slot.manualSlotId
  const [classId, setClassId] = useState(slot.classId)
  const [subjectId, setSubjectId] = useState(slot.subjectId ?? '')
  const [periodStart, setPeriodStart] = useState(String(slot.periodStart))
  const [periodEnd, setPeriodEnd] = useState(String(slot.periodEnd))
  const [absentTeacher, setAbsentTeacher] = useState<TeacherComboboxValue>({
    teacherId: slot.absentTeacherId,
    name: slot.absentTeacherName,
  })
  const [dutyTeacher, setDutyTeacher] = useState<TeacherComboboxValue>({
    teacherId: slot.substitution?.substituteTeacherId ?? null,
    name: slot.substitution?.substituteTeacherName ?? '',
  })
  const [activity, setActivity] = useState(slot.substitution?.activity ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const pending = updateSub.isPending || updateManual.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (isManual) {
      const ps = Number(periodStart)
      const pe = Number(periodEnd)
      if (!classId) nextErrors.classId = 'Pilih kelas.'
      if (!Number.isInteger(ps) || ps < 1 || ps > 12) nextErrors.periodStart = 'Jam mulai 1–12.'
      if (!Number.isInteger(pe) || pe < 1 || pe > 12) nextErrors.periodEnd = 'Jam selesai 1–12.'
      else if (!nextErrors.periodStart && pe < ps) nextErrors.periodEnd = 'Jam selesai tidak boleh sebelum jam mulai.'
      if (!absentTeacher.name.trim()) nextErrors.absentTeacherName = 'Nama guru tidak hadir wajib diisi.'
    }
    if (!dutyTeacher.name.trim()) {
      nextErrors.substituteTeacherName = 'Nama guru piket/pengganti wajib diisi.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors({})

    try {
      if (isManual && slot.manualSlotId) {
        await updateManual.mutateAsync({
          id: slot.manualSlotId,
          body: {
            classId,
            subjectId: subjectId || null,
            periodStart: Number(periodStart),
            periodEnd: Number(periodEnd),
            absentTeacherId: absentTeacher.teacherId,
            absentTeacherName: absentTeacher.name.trim(),
            substituteTeacherId: dutyTeacher.teacherId,
            substituteTeacherName: dutyTeacher.name.trim(),
            activity: activity.trim() || null,
          },
        })
        toast.success('Jam kosong berhasil diperbarui.')
      } else if (slot.substitution) {
        await updateSub.mutateAsync({
          id: slot.substitution.id,
          body: {
            substituteTeacherId: dutyTeacher.teacherId,
            substituteTeacherName: dutyTeacher.name.trim(),
            activity: activity.trim() || null,
          },
        })
        toast.success('Penugasan guru piket diperbarui.')
      }
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Edit Penugasan Jam Kosong</DialogTitle>
        <DialogDescription>
          {slot.className} · Jam ke-{slot.periodStart}–{slot.periodEnd} · {slot.subjectName}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4" noValidate>
        {isManual ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Kelas" required error={errors.classId} id="edit-slot-class">
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className={SELECT_CLS}
                >
                  {(classes.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Mata Pelajaran" id="edit-slot-subject">
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">Pelajaran Umum</option>
                  {(subjects.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Jam Ke- Mulai" required error={errors.periodStart} id="edit-slot-ps">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </FormField>
              <FormField label="Jam Ke- Selesai" required error={errors.periodEnd} id="edit-slot-pe">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </FormField>
            </div>
            <FormField
              label="Guru Tidak Hadir"
              required
              error={errors.absentTeacherName}
              id="edit-slot-absent"
            >
              <TeacherCombobox
                ariaLabel="Guru Tidak Hadir"
                teachers={teachers.data ?? []}
                value={absentTeacher}
                onChange={setAbsentTeacher}
              />
            </FormField>
          </>
        ) : (
          <div className="rounded-lg border border-border/80 bg-muted/35 px-3.5 py-2.5 text-xs">
            <p className="text-muted-foreground">Guru tidak hadir</p>
            <p className="mt-0.5 font-semibold text-foreground">{slot.absentTeacherName}</p>
          </div>
        )}

        <FormField
          label="Guru Piket / Pengganti"
          required
          error={errors.substituteTeacherName}
          hint="Pilih dari daftar guru atau ketik nama bebas."
          id="edit-slot-duty"
        >
          <TeacherCombobox
            ariaLabel="Guru Piket / Pengganti"
            teachers={teachers.data ?? []}
            value={dutyTeacher}
            onChange={setDutyTeacher}
            placeholder="Pilih atau ketik nama guru piket…"
          />
        </FormField>

        <FormField label="Kegiatan / Catatan" id="edit-slot-activity">
          <Textarea
            id="edit-slot-activity"
            rows={2}
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="Mis. Tugas mandiri atau pengawasan guru piket"
          />
        </FormField>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending}>
            <Save /> {pending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
