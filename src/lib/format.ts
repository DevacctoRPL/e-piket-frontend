/** Format angka berlocale Indonesia (pemisah ribuan titik, desimal koma). */
const intFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
const oneDecFmt = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** 4790 → '4.790' */
export function formatNumber(n: number | null | undefined): string {
  return n == null || Number.isNaN(n) ? '—' : intFmt.format(n)
}

/** 94.2 → '94%' (bulat) */
export function formatPercent(n: number | null | undefined): string {
  return n == null || Number.isNaN(n) ? '—' : `${intFmt.format(n)}%`
}

/** 4.25 → '+4,3%'; -2 → '−2,0%'; 0 → '0,0%' */
export function formatDelta(pct: number): string {
  const abs = oneDecFmt.format(Math.abs(pct))
  if (pct > 0) return `+${abs}%`
  if (pct < 0) return `−${abs}%`
  return `${abs}%`
}

/**
 * Nada delta: kenaikan baik (hijau) / buruk (merah) bergantung `upIsGood`; nol netral.
 */
export function deltaTone(pct: number, upIsGood = true): 'good' | 'bad' | 'flat' {
  if (pct === 0) return 'flat'
  return pct > 0 === upIsGood ? 'good' : 'bad'
}
