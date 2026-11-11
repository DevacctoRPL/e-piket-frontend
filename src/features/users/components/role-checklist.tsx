import { Lock } from 'lucide-react'
import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { ROLE_DESCRIPTION, ROLE_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import { ROLES, type Role } from '@/types/entities'

export interface RoleLock {
  role: Role
  /** Alasan singkat mengapa peran terkunci (tampil sebagai petunjuk). */
  reason: string
}

/**
 * Daftar centang peran dengan deskripsi satu kalimat per peran.
 * Peran terkunci (`locked`) tidak dapat diubah — mis. Super Admin/Admin bila pelaku tidak berhak,
 * atau Super Admin pada akun sendiri (cegah menurunkan diri sendiri).
 */
export function RoleChecklist({
  value,
  onChange,
  locked,
  error,
}: {
  value: Role[]
  onChange: (roles: Role[]) => void
  locked: RoleLock[]
  error?: string
}) {
  const id = useId()
  const selected = new Set(value)
  const lockBy = new Map(locked.map((l) => [l.role, l.reason]))
  const toggle = (role: Role, on: boolean) => {
    const next = on ? [...value, role] : value.filter((r) => r !== role)
    // jaga urutan kanonis agar diff payload stabil
    onChange(ROLES.filter((r) => next.includes(r)))
  }

  return (
    <fieldset
      className="grid gap-2"
      aria-describedby={error ? `${id}-err` : undefined}
      aria-invalid={!!error || undefined}
    >
      <legend className="mb-1.5 flex w-full items-center justify-between gap-2 text-sm font-medium">
        <span>
          Peran
          <span className="text-destructive" aria-hidden>
            *
          </span>
        </span>
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{value.length} dipilih</span>
      </legend>
      <div className={cn('grid gap-0.5 rounded-md border border-input p-1.5', error && 'border-destructive')}>
        {ROLES.map((role) => {
          const cid = `${id}-${role}`
          const lockReason = lockBy.get(role)
          const Icon = ROLE_META[role].icon
          return (
            <label
              key={role}
              htmlFor={cid}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent',
                lockReason && 'cursor-not-allowed hover:bg-transparent',
              )}
            >
              <Checkbox
                id={cid}
                className="mt-0.5"
                checked={selected.has(role)}
                disabled={!!lockReason}
                aria-label={ROLE_META[role].label}
                aria-describedby={`${cid}-desc`}
                onCheckedChange={(c) => toggle(role, c === true)}
              />
              <span className={cn('min-w-0 flex-1', lockReason && 'opacity-60')}>
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  {Icon && <Icon aria-hidden className="size-3.5 text-muted-foreground" />}
                  {ROLE_META[role].label}
                </span>
                <span id={`${cid}-desc`} className="block text-xs text-pretty text-muted-foreground">
                  {ROLE_DESCRIPTION[role]}
                  {lockReason && (
                    <span className="mt-0.5 flex items-center gap-1 text-foreground/70">
                      <Lock aria-hidden className="size-3" /> {lockReason}
                    </span>
                  )}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      {error && (
        <p id={`${id}-err`} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
