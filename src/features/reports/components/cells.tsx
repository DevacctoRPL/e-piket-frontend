import { ChevronRight, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { formatNumber } from '../lib/format'

/** Angka hitungan; nol diredam agar angka penting menonjol. */
export function Num({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('tabular-nums', value === 0 && 'text-muted-foreground/60', className)}>
      {formatNumber(value)}
    </span>
  )
}

/** Ikon info dengan tooltip (penjelasan rumus). Teks juga tersedia untuk pembaca layar. */
export function InfoTip({ children, label = 'Keterangan' }: { children: ReactNode; label?: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="size-5 text-muted-foreground hover:text-foreground"
          >
            <Info className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-pretty">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Tautan penelusuran ke halaman operasional (FR-RPT-01). */
export function DrillLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'group/drill inline-flex items-center gap-0.5 rounded-sm font-medium text-foreground/85 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      {children}
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover/drill:text-foreground" aria-hidden />
    </Link>
  )
}

/** Pasangan label/nilai ringkas di kartu ponsel. */
export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col rounded-md border border-border/70 bg-muted/40 px-2 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  )
}

export const textOrDash = (v: string | null | undefined) => (v && v.trim() ? v : '—')
