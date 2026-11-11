import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface RowAction {
  label: string
  icon?: LucideIcon
  onSelect?: () => void
  /** Navigasi (Link) sebagai ganti onSelect. */
  href?: string
  destructive?: boolean
  disabled?: boolean
  /** Sisipkan pemisah sebelum item ini. */
  separated?: boolean
  hidden?: boolean
}

/**
 * Tombol kebab di akhir baris tabel/kartu (gaya referensi Nuvio) — menggantikan deretan ikon pensil/hapus.
 * `label` dipakai untuk aria-label, mis. "Aksi untuk X TKJ 1".
 */
export function RowActionsMenu({
  label,
  actions,
  align = 'end',
}: {
  label: string
  actions: RowAction[]
  align?: 'start' | 'end'
}) {
  const visible = actions.filter((a) => !a.hidden)
  if (visible.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className="text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48" onClick={(e) => e.stopPropagation()}>
        {visible.map((a, i) => {
          const Icon = a.icon
          const content = (
            <>
              {Icon && <Icon />}
              {a.label}
            </>
          )
          return (
            <div key={`${a.label}-${i}`}>
              {a.separated && i > 0 && <DropdownMenuSeparator />}
              {a.href ? (
                <DropdownMenuItem asChild disabled={a.disabled}>
                  <Link to={a.href}>{content}</Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant={a.destructive ? 'destructive' : 'default'}
                  disabled={a.disabled}
                  onSelect={() => a.onSelect?.()}
                >
                  {content}
                </DropdownMenuItem>
              )}
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
