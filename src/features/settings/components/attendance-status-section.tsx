import { Controller, useFieldArray, useFormContext } from 'react-hook-form'
import { ToneBadge } from '@/components/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/misc'
import { ATTENDANCE_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { SettingsFormValues } from '../schemas'

export function AttendanceStatusSection() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<SettingsFormValues>()
  const { fields } = useFieldArray({ control, name: 'attendanceStatuses', keyName: 'key' })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Absensi Siswa</CardTitle>
        <CardDescription>
          Atur label tampilan, kode singkat untuk rekap cetak/ekspor (mis. S/I/A), kewajiban alasan, dan status yang
          dapat dipilih. Status Hadir selalu aktif. Kode sistem tidak berubah sehingga data lama tetap konsisten.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div role="table" aria-label="Konfigurasi status absensi" className="flex flex-col gap-2 md:gap-0 md:rounded-xl md:border">
          <div
            role="row"
            className="hidden grid-cols-[minmax(8rem,1fr)_minmax(10rem,1.4fr)_6rem_7rem_6rem] items-center gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase md:grid"
          >
            <span role="columnheader">Status</span>
            <span role="columnheader">Label tampilan</span>
            <span role="columnheader">Kode singkat</span>
            <span role="columnheader">Wajib alasan</span>
            <span role="columnheader">Aktif</span>
          </div>
          {fields.map((f, i) => {
            const rowErr = errors.attendanceStatuses?.[i]
            const isPresent = f.code === 'PRESENT'
            const labelId = `status-${f.code}-label`
            return (
              <div
                role="row"
                key={f.key}
                className={cn(
                  'grid grid-cols-2 gap-3 rounded-xl border p-3 md:grid-cols-[minmax(8rem,1fr)_minmax(10rem,1.4fr)_6rem_7rem_6rem] md:items-start md:rounded-none md:border-0 md:border-b md:last:border-b-0',
                )}
              >
                <div role="cell" className="col-span-2 flex items-center gap-2 md:col-span-1 md:pt-1.5">
                  <ToneBadge tone={ATTENDANCE_META[f.code].tone}>{ATTENDANCE_META[f.code].label}</ToneBadge>
                  <span id={labelId} className="font-mono text-[11px] text-muted-foreground">{f.code}</span>
                </div>
                <div role="cell" className="col-span-2 grid gap-1 md:col-span-1">
                  <label htmlFor={`st-${i}-label`} className="text-xs text-muted-foreground md:sr-only">
                    Label tampilan
                  </label>
                  <Input
                    id={`st-${i}-label`}
                    {...register(`attendanceStatuses.${i}.label`)}
                    aria-invalid={rowErr?.label ? true : undefined}
                    aria-describedby={rowErr?.label ? `st-${i}-label-err` : labelId}
                  />
                  {rowErr?.label && <p id={`st-${i}-label-err`} className="text-xs font-medium text-destructive">{rowErr.label.message}</p>}
                </div>
                <div role="cell" className="grid gap-1">
                  <label htmlFor={`st-${i}-short`} className="text-xs text-muted-foreground md:sr-only">
                    Kode singkat
                  </label>
                  <Input
                    id={`st-${i}-short`}
                    maxLength={3}
                    className="uppercase"
                    {...register(`attendanceStatuses.${i}.shortCode`)}
                    aria-invalid={rowErr?.shortCode ? true : undefined}
                    aria-describedby={rowErr?.shortCode ? `st-${i}-short-err` : labelId}
                  />
                  {rowErr?.shortCode && <p id={`st-${i}-short-err`} className="text-xs font-medium text-destructive">{rowErr.shortCode.message}</p>}
                </div>
                <div role="cell" className="flex flex-col gap-1 md:pt-2">
                  <Controller
                    control={control}
                    name={`attendanceStatuses.${i}.requiresReason`}
                    render={({ field }) => (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(c) => field.onChange(c === true)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          aria-describedby={labelId}
                        />
                        <span>Wajib alasan</span>
                      </label>
                    )}
                  />
                </div>
                <div role="cell" className="col-span-2 flex flex-col gap-1 md:col-span-1 md:pt-1.5">
                  <Controller
                    control={control}
                    name={`attendanceStatuses.${i}.active`}
                    render={({ field }) => (
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          disabled={isPresent}
                          aria-describedby={labelId}
                        />
                        <span>{field.value ? 'Aktif' : 'Nonaktif'}</span>
                      </label>
                    )}
                  />
                  {isPresent && <p className="text-[11px] text-muted-foreground">Selalu aktif</p>}
                  {rowErr?.active && <p className="text-xs font-medium text-destructive">{rowErr.active.message}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
