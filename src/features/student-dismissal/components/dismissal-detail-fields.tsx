import type { UseFormReturn } from 'react-hook-form'
import { FormField } from '@/components/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DISMISSAL_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import { DISMISSAL_TYPES, type DismissalType } from '@/types/entities'
import type { DismissalFormValues } from '../schemas'

const TYPE_HINT: Record<DismissalType, string> = {
  NORMAL: 'Pulang sesuai jam pulang sekolah.',
  EARLY_LEAVE: 'Pulang sebelum jam pelajaran selesai.',
  TEMPORARY_EXIT: 'Keluar sementara lalu kembali ke sekolah.',
}

const RELATION_SUGGESTIONS = ['Ayah', 'Ibu', 'Kakak', 'Paman', 'Bibi', 'Kakek', 'Nenek', 'Wali', 'Ojek langganan']

/** Pilihan jenis kepulangan bergaya segmented control (radio native — aksesibel dengan keyboard). */
export function DismissalTypeSegmented({
  form,
  disabled,
}: {
  form: UseFormReturn<DismissalFormValues>
  disabled?: boolean
}) {
  const error = form.formState.errors.type?.message
  const current = form.watch('type')
  return (
    <fieldset className="grid gap-1.5" aria-describedby={error ? 'dismissal-type-error' : 'dismissal-type-hint'}>
      <legend className="mb-1.5 text-sm font-medium">
        Jenis kepulangan <span className="text-destructive" aria-hidden>*</span>
      </legend>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {DISMISSAL_TYPES.map((t) => (
          <label
            key={t}
            className={cn(
              'flex min-h-10 cursor-pointer items-center justify-center rounded-md px-2 py-1.5 text-center text-xs leading-tight font-semibold text-foreground/70 transition-[color,background-color,box-shadow] duration-150 select-none sm:text-sm',
              'has-[:checked]:bg-background has-[:checked]:text-foreground has-[:checked]:shadow-sm',
              'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              value={t}
              className="sr-only"
              disabled={disabled}
              {...form.register('type')}
            />
            {DISMISSAL_META[t].label}
          </label>
        ))}
      </div>
      {error ? (
        <p id="dismissal-type-error" className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p id="dismissal-type-hint" className="text-xs text-muted-foreground">
          {current ? TYPE_HINT[current] : 'Pilih salah satu jenis kepulangan.'}
        </p>
      )}
    </fieldset>
  )
}

/**
 * Field detail kepulangan yang dipakai formulir catat & koreksi:
 * jenis, waktu keluar/kembali, penjemput/penerima, catatan.
 */
export function DismissalDetailFields({
  form,
  requiresPickup,
  disabled,
  idPrefix,
}: {
  form: UseFormReturn<DismissalFormValues>
  requiresPickup: boolean
  disabled?: boolean
  idPrefix: string
}) {
  const { register, formState, watch } = form
  const errors = formState.errors
  const type = watch('type')
  const pickupRequired = requiresPickup && (type === 'NORMAL' || type === 'EARLY_LEAVE')
  const isTemporary = type === 'TEMPORARY_EXIT'
  return (
    <>
      <DismissalTypeSegmented form={form} disabled={disabled} />

      <div className="grid grid-cols-2 gap-3">
        <FormField id={`${idPrefix}-exit`} label="Waktu keluar" required error={errors.exitTime?.message}>
          <Input type="time" disabled={disabled} className="tabular-nums" {...register('exitTime')} />
        </FormField>
        {isTemporary && (
          <FormField
            id={`${idPrefix}-return`}
            label="Waktu kembali"
            hint="Kosongkan bila belum kembali."
            error={errors.returnTime?.message}
          >
            <Input type="time" disabled={disabled} className="tabular-nums" {...register('returnTime')} />
          </FormField>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <FormField
          id={`${idPrefix}-pickup`}
          label={isTemporary ? 'Pihak yang mengizinkan/menerima' : 'Penjemput/penerima'}
          required={pickupRequired}
          hint={
            pickupRequired
              ? 'Wajib menurut kebijakan sekolah.'
              : isTemporary
                ? 'Opsional untuk izin keluar.'
                : 'Opsional.'
          }
          error={errors.pickupName?.message}
        >
          <Input autoComplete="off" placeholder="Nama lengkap" disabled={disabled} {...register('pickupName')} />
        </FormField>
        <FormField id={`${idPrefix}-relation`} label="Hubungan" error={errors.pickupRelation?.message}>
          <Input
            autoComplete="off"
            list={`${idPrefix}-relations`}
            placeholder="mis. Ayah"
            disabled={disabled}
            {...register('pickupRelation')}
          />
        </FormField>
        <datalist id={`${idPrefix}-relations`}>
          {RELATION_SUGGESTIONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>

      <FormField
        id={`${idPrefix}-note`}
        label={type === 'EARLY_LEAVE' ? 'Alasan pulang lebih awal' : 'Catatan'}
        required={type === 'EARLY_LEAVE'}
        hint={type === 'EARLY_LEAVE' ? 'mis. sakit, keperluan keluarga.' : 'Opsional.'}
        error={errors.note?.message}
      >
        <Textarea rows={3} disabled={disabled} placeholder="Tulis keterangan singkat…" {...register('note')} />
      </FormField>
    </>
  )
}
