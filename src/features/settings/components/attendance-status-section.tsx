import { ListChecks } from 'lucide-react'
import { Controller, useFieldArray, useFormContext } from 'react-hook-form'
import { FramedCard } from '@/components/framed-card'
import { ToneBadge } from '@/components/status-badge'
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
    <FramedCard icon={<ListChecks />} title="Status Absensi Siswa" bodyClassName="flex flex-col gap-3">
        <p className="text-[13px] text-pretty text-muted-foreground">
          Atur label tampilan, kode singkat untuk rekap cetak/ekspor (mis. S/I/A), kewajiban alasan, dan status yang
          dapat dipilih. Status Hadir selalu aktif. Kode sistem tidak berubah sehingga data lama tetap konsisten.
        </p>
        <div
          role="table"
          aria-label="Konfigurasi status absensi"
          className="flex flex-col gap-2 md:-mx-4 md:-mb-4 md:gap-0 md:border-t md:border-border/70"
        >
          <div
            role="row"
            className="hidden grid-cols-[minmax(8rem,1fr)_minmax(10rem,1.4fr)_6rem_7rem_6rem] items-center gap-3 border-b border-border/70 bg-muted/55 px-4 py-2 text-xs font-medium text-muted-foreground md:grid"
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
                  'grid grid-cols-2 gap-3 rounded-md border border-border/80 p-3 md:grid-cols-[minmax(8rem,1fr)_minmax(10rem,1.4fr)_6rem_7rem_6rem] md:items-start md:rounded-none md:border-0 md:border-b md:border-border/60 md:px-4 md:last:border-b-0',
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
                      <label className="flex items-center gap-2 text-[13px]">
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
                      <label className="flex items-center gap-2 text-[13px]">
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
    </FramedCard>
  )
}
