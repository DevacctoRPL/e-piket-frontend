import { useId, type ReactElement, type ReactNode } from 'react'
import { cloneElement } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Pembungkus field: label, hint, pesan error, dan atribut aksesibilitas (aria-invalid, aria-describedby).
 *   <FormField label="Materi" required error={errors.topic?.message}><Input {...register('topic')} /></FormField>
 */
export function FormField({
  label,
  required,
  hint,
  error,
  children,
  className,
  id: idProp,
}: {
  label: ReactNode
  required?: boolean
  hint?: ReactNode
  error?: string
  children: ReactElement<Record<string, unknown>>
  className?: string
  id?: string
}) {
  const autoId = useId()
  const id = idProp ?? autoId
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** Select HTML native bergaya input — ringan & ramah ponsel untuk form dan filter. */
export function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'native-select flex h-8 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-input bg-card py-1 pr-8 pl-2.5 text-[13px] font-medium text-foreground shadow-2xs transition-[color,box-shadow] outline-none hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
