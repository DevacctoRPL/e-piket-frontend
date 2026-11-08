import { Clock, ExternalLink, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { Link } from 'react-router'
import { ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton, Switch } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/auth-context'
import { useShifts } from '@/features/master-data/lookups'
import { formatWallTime } from '@/lib/date'
import { TEACHER_ATTENDANCE_META } from '@/lib/enums'
import { TEACHER_ATTENDANCE_STATUSES, type TeacherAttendanceStatus } from '@/types/entities'
import type { SettingsFormValues } from '../schemas'

const TEACHER_REASON_OPTIONS = TEACHER_ATTENDANCE_STATUSES.filter((s) => s !== 'PRESENT')

export function TeacherRulesSection() {
  const { control } = useFormContext<SettingsFormValues>()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aturan Absensi Guru</CardTitle>
        <CardDescription>
          Pilih status kehadiran guru yang wajib disertai alasan saat dicatat oleh guru, piket, atau admin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Controller
          control={control}
          name="teacherReasonRequiredStatuses"
          render={({ field }) => {
            const toggle = (s: TeacherAttendanceStatus, on: boolean) =>
              field.onChange(
                TEACHER_ATTENDANCE_STATUSES.filter((x) => (x === s ? on : field.value.includes(x))),
              )
            return (
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="sr-only">Status guru yang wajib alasan</legend>
                {TEACHER_REASON_OPTIONS.map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-3 rounded-lg border p-3 text-sm has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/5"
                  >
                    <Checkbox
                      checked={field.value.includes(s)}
                      onCheckedChange={(c) => toggle(s, c === true)}
                      onBlur={field.onBlur}
                    />
                    <ToneBadge tone={TEACHER_ATTENDANCE_META[s].tone}>{TEACHER_ATTENDANCE_META[s].label}</ToneBadge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {field.value.includes(s) ? 'Wajib alasan' : 'Opsional'}
                    </span>
                  </label>
                ))}
              </fieldset>
            )
          }}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Status Hadir tidak memerlukan alasan. Status Terlambat tetap mencatat jumlah menit keterlambatan secara otomatis.
        </p>
      </CardContent>
    </Card>
  )
}

export function DismissalSection() {
  const { control } = useFormContext<SettingsFormValues>()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kepulangan Siswa</CardTitle>
        <CardDescription>Aturan pencatatan siswa pulang lebih awal dan izin keluar.</CardDescription>
      </CardHeader>
      <CardContent>
        <Controller
          control={control}
          name="dismissalRequiresPickup"
          render={({ field }) => (
            <label className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <span className="space-y-1">
                <span className="block text-sm font-medium">Nama penjemput/penerima wajib diisi</span>
                <span className="block text-xs text-muted-foreground">
                  Berlaku untuk pulang lebih awal dan izin keluar. Pulang normal tidak memerlukan penjemput.
                </span>
              </span>
              <Switch checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />
            </label>
          )}
        />
      </CardContent>
    </Card>
  )
}

export function DutyCategoriesSection() {
  const {
    control,
    formState: { errors },
  } = useFormContext<SettingsFormValues>()
  const [draft, setDraft] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kategori Catatan Piket</CardTitle>
        <CardDescription>
          Pilihan kategori saat guru piket menulis catatan penting harian. Catatan lama tetap menyimpan kategorinya
          walau kategori dihapus.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Controller
          control={control}
          name="dutyNoteCategories"
          render={({ field }) => {
            const add = () => {
              const v = draft.trim()
              if (!v) return
              if (v.length > 30) return setLocalError('Nama kategori maksimal 30 karakter.')
              if (field.value.some((c) => c.toLowerCase() === v.toLowerCase()))
                return setLocalError('Kategori sudah ada.')
              if (field.value.length >= 20) return setLocalError('Maksimal 20 kategori.')
              field.onChange([...field.value, v])
              setDraft('')
              setLocalError(null)
            }
            const err = localError ?? errors.dutyNoteCategories?.message ?? errors.dutyNoteCategories?.root?.message
            return (
              <div className="flex flex-col gap-3">
                {field.value.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Belum ada kategori. Tambahkan minimal satu kategori.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2" aria-label="Daftar kategori">
                    {field.value.map((c) => (
                      <li
                        key={c}
                        className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-1 pr-1 pl-3 text-sm"
                      >
                        <span className="max-w-48 truncate">{c}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-6 rounded-full"
                          onClick={() => field.onChange(field.value.filter((x) => x !== c))}
                          aria-label={`Hapus kategori ${c}`}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value)
                      setLocalError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        add()
                      }
                    }}
                    placeholder="Kategori baru, mis. Kebersihan"
                    aria-label="Nama kategori baru"
                    aria-invalid={err ? true : undefined}
                    maxLength={40}
                    className="max-w-xs"
                  />
                  <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
                    <Plus /> Tambah
                  </Button>
                </div>
                {err && (
                  <p className="text-xs font-medium text-destructive" role="alert">
                    {err}
                  </p>
                )}
              </div>
            )
          }}
        />
      </CardContent>
    </Card>
  )
}

/** Info baca-saja: shift, jam masuk, toleransi keterlambatan dikelola di Data Master. */
export function MasterInfoCard() {
  const shifts = useShifts()
  const { can } = useAuth()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" /> Shift, Jam Masuk &amp; Toleransi Keterlambatan
        </CardTitle>
        <CardDescription>
          Diatur di Data Master karena terkait jadwal dan jam pelajaran. Ringkasan saat ini:
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {shifts.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : shifts.isError ? (
          <p className="text-sm text-muted-foreground">Ringkasan shift tidak dapat dimuat.</p>
        ) : shifts.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada shift terdaftar.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {shifts.data.map((s) => (
              <li key={s.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{s.name}</span>
                  <ToneBadge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Aktif' : 'Nonaktif'}</ToneBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {formatWallTime(s.startTime)}–{formatWallTime(s.endTime)} · toleransi {s.lateToleranceMinutes} menit
                </p>
              </li>
            ))}
          </ul>
        )}
        {can('master:write') && (
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link to="/master">
              Kelola di Data Master <ExternalLink />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
