import { cn } from '@/lib/utils'

/** 'Agus Salim, S.Kom.' → 'AS' (gelar setelah koma diabaikan). */
export function getInitials(name: string): string {
  const parts = name
    .replace(/,.*$/, '')
    .replace(/^(Drs?|Dr|Ir|H|Hj)\.\s*/i, '')
    .split(/\s+/)
    .filter((p) => /^[\p{L}]/u.test(p))
  return (parts.slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase()
}

const SIZE = {
  xs: 'size-5 rounded-[5px] text-[9px]',
  sm: 'size-6 rounded-md text-[10px]',
  md: 'size-8 rounded-md text-xs',
  lg: 'size-12 rounded-lg text-base',
} as const

/** Avatar inisial persegi membulat — satu bentuk untuk seluruh aplikasi. */
export function Avatar({
  name,
  size = 'md',
  variant = 'muted',
  className,
}: {
  name: string
  size?: keyof typeof SIZE
  /** muted: abu netral; solid: gelap (akun pengguna saat ini). */
  variant?: 'muted' | 'solid'
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold select-none',
        SIZE[size],
        variant === 'solid'
          ? 'bg-primary text-primary-foreground'
          : 'border border-border/80 bg-muted/60 text-foreground/75',
        className,
      )}
    >
      {getInitials(name)}
    </span>
  )
}
