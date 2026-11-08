import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatDateLong, todayISO } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { SettingsFormValues } from '../schemas'

const MAX_LINES = 6

export function IdentitySection() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<SettingsFormValues>()
  const lines = useFieldArray({ control, name: 'letterheadLines' })
  const linesError = errors.letterheadLines?.message ?? errors.letterheadLines?.root?.message

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Identitas Sekolah</CardTitle>
            <CardDescription>Dipakai pada kop, tanda tangan, dan dokumen cetak.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nama sekolah" required error={errors.schoolName?.message} className="sm:col-span-2">
              <Input {...register('schoolName')} autoComplete="organization" />
            </FormField>
            <FormField label="Alamat sekolah" error={errors.schoolAddress?.message} className="sm:col-span-2">
              <Textarea rows={2} {...register('schoolAddress')} />
            </FormField>
            <FormField label="Kota" required hint="Ditampilkan di atas tanda tangan cetak." error={errors.city?.message}>
              <Input {...register('city')} />
            </FormField>
            <div className="hidden sm:block" />
            <FormField label="Nama kepala sekolah" required error={errors.principalName?.message}>
              <Input {...register('principalName')} />
            </FormField>
            <FormField label="NIP kepala sekolah" error={errors.principalNip?.message}>
              <Input inputMode="numeric" {...register('principalNip')} />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kop Cetak</CardTitle>
            <CardDescription>
              Baris kop surat di bagian atas setiap dokumen cetak. Baris ketiga ditampilkan paling besar (nama sekolah).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ol className="flex flex-col gap-2">
              {lines.fields.map((f, i) => {
                const err = errors.letterheadLines?.[i]?.value?.message
                return (
                  <li key={f.id} className="flex items-start gap-2">
                    <span className="mt-2 w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums" aria-hidden>
                      {i + 1}.
                    </span>
                    <div className="grid min-w-0 flex-1 gap-1">
                      <Input
                        {...register(`letterheadLines.${i}.value`)}
                        aria-label={`Baris kop ${i + 1}`}
                        aria-invalid={err ? true : undefined}
                      />
                      {err && <p className="text-xs font-medium text-destructive" role="alert">{err}</p>}
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => lines.move(i, i - 1)} aria-label={`Naikkan baris ${i + 1}`}>
                        <ArrowUp />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" disabled={i === lines.fields.length - 1} onClick={() => lines.move(i, i + 1)} aria-label={`Turunkan baris ${i + 1}`}>
                        <ArrowDown />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" disabled={lines.fields.length <= 1} onClick={() => lines.remove(i)} aria-label={`Hapus baris ${i + 1}`}>
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ol>
            {linesError && <p className="text-xs font-medium text-destructive" role="alert">{linesError}</p>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={lines.fields.length >= MAX_LINES}
              onClick={() => lines.append({ value: '' })}
            >
              <Plus /> Tambah baris
            </Button>
            {lines.fields.length >= MAX_LINES && (
              <p className="text-xs text-muted-foreground">Maksimal {MAX_LINES} baris kop.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <LetterheadPreview />
    </div>
  )
}

/** Pratinjau langsung kop cetak — mengikuti gaya header PrintDocument. */
function LetterheadPreview() {
  const { control } = useFormContext<SettingsFormValues>()
  const lines = useWatch({ control, name: 'letterheadLines' })
  const city = useWatch({ control, name: 'city' })
  const principalName = useWatch({ control, name: 'principalName' })
  const principalNip = useWatch({ control, name: 'principalNip' })
  const visible = (lines ?? []).map((l) => l.value.trim()).filter(Boolean)

  return (
    <Card className="lg:sticky lg:top-4 lg:self-start">
      <CardHeader>
        <CardTitle>Pratinjau Cetak</CardTitle>
        <CardDescription>Tampilan kop dan tanda tangan pada dokumen cetak/PDF.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="overflow-hidden rounded-lg border bg-white p-4 text-[12px] leading-snug text-black shadow-sm sm:p-6"
          aria-label="Pratinjau kop cetak"
          role="region"
        >
          <header className="border-b-[3px] border-double border-black pb-3 text-center">
            {visible.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Kop sekolah belum diisi</p>
            ) : (
              visible.map((line, i) => (
                <p
                  key={i}
                  className={cn(
                    'break-words',
                    i === 2 ? 'text-base font-bold sm:text-lg' : 'text-xs font-semibold sm:text-sm',
                    i === 3 && 'font-normal text-[11px] sm:text-xs',
                  )}
                >
                  {line}
                </p>
              ))
            )}
          </header>
          <div className="mt-3 text-center">
            <p className="text-sm font-bold tracking-wide uppercase">Contoh Judul Formulir</p>
          </div>
          <div className="mt-3 space-y-1.5" aria-hidden>
            <div className="h-2 rounded bg-gray-200" />
            <div className="h-2 w-5/6 rounded bg-gray-200" />
            <div className="h-2 w-4/6 rounded bg-gray-200" />
          </div>
          <div className="mt-6 ml-auto w-fit min-w-40 text-center text-[11px]">
            <p>
              {city.trim() || '(Kota)'}, {formatDateLong(todayISO())}
            </p>
            <p>Kepala Sekolah</p>
            <div className="h-10" />
            <p className="font-semibold underline">{principalName.trim() || '(..............................)'}</p>
            {principalNip.trim() && <p>NIP. {principalNip.replace(/\s+/g, '')}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
