import { Search, X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Input pencarian kecil dengan ikon di depan dan tombol hapus opsional.
 * `onValueChange` dipakai bila ingin menampilkan tombol hapus.
 */
export function SearchField({
  className,
  inputClassName,
  value,
  onValueChange,
  onChange,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & {
  inputClassName?: string
  onValueChange?: (v: string) => void
}) {
  const clearable = !!onValueChange && typeof value === 'string' && value.length > 0
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
        data-slot="input"
        value={value}
        onChange={(e) => {
          onChange?.(e)
          onValueChange?.(e.target.value)
        }}
        {...props}
        className={cn(
          'flex h-8 w-full min-w-0 rounded-md border border-input bg-card py-1 pr-7 pl-8 text-[13px] shadow-2xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden',
          inputClassName,
        )}
      />
      {clearable && (
        <button
          type="button"
          onClick={() => onValueChange?.('')}
          aria-label="Hapus pencarian"
          className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
