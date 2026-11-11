import logoMark from '@/assets/logo-mark.png'
import logoMarkLight from '@/assets/logo-mark-light.png'
import { cn } from '@/lib/utils'

/**
 * Logo E-Piket (tanda centang + figur). `tone="dark"` untuk latar terang, `tone="light"` untuk latar gelap.
 * Gambar bersifat dekoratif bila teks "E-Piket" ditampilkan di sebelahnya.
 */
export function LogoMark({
  tone = 'dark',
  className,
  decorative = true,
}: {
  tone?: 'dark' | 'light'
  className?: string
  decorative?: boolean
}) {
  return (
    <img
      src={tone === 'light' ? logoMarkLight : logoMark}
      alt={decorative ? '' : 'E-Piket'}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={cn('size-7 shrink-0 object-contain select-none', className)}
    />
  )
}

/** Logo + nama aplikasi. */
export function Logo({
  tone = 'dark',
  collapsed = false,
  className,
  markClassName,
}: {
  tone?: 'dark' | 'light'
  collapsed?: boolean
  className?: string
  markClassName?: string
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <LogoMark tone={tone} className={markClassName} decorative={!collapsed} />
      {!collapsed && (
        <span
          className={cn(
            'truncate text-[15px] font-bold tracking-tight',
            tone === 'light' ? 'text-primary-foreground' : 'text-foreground',
          )}
        >
          E-Piket
        </span>
      )}
    </span>
  )
}
