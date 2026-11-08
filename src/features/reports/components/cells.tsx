import { ChevronRight, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
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
          <button
            type="button"
            aria-label={label}
            className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Info className="size-3.5" />
          </button>
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
        'inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      {children}
      <ChevronRight className="size-3.5 shrink-0" aria-hidden />
    </Link>
  )
}

/** Pasangan label/nilai ringkas di kartu ponsel. */
export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg bg-muted/50 px-2 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  )
}

export const textOrDash = (v: string | null | undefined) => (v && v.trim() ? v : '—')
