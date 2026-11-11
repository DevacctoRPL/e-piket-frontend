import { MetaTag, StatusBadge } from '@/components/status-badge'
import { EXTRA_ACTIVITY_TYPE_META } from '@/lib/enums'
import { formatWallTime } from '@/lib/date'
import type { ExtraActivity } from '@/types/entities'

export function TypeBadge({ type }: { type: ExtraActivity['type'] }) {
  return <MetaTag>{EXTRA_ACTIVITY_TYPE_META[type].label}</MetaTag>
}

/** Daftar kelas sebagai chip (satu agenda → beberapa kelas, FR-EXT-02). */
export function ClassChips({ names, max }: { names: string[]; max?: number }) {
  const shown = max ? names.slice(0, max) : names
  const rest = names.length - shown.length
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Kelas peserta">
      {shown.map((n) => (
        <li key={n}>
          <MetaTag>{n}</MetaTag>
        </li>
      ))}
      {rest > 0 && (
        <li className="px-1 py-px text-[11px] text-muted-foreground" title={names.slice(shown.length).join(', ')}>
          +{rest} lainnya
        </li>
      )}
    </ul>
  )
}

export function timeRange(a: Pick<ExtraActivity, 'startTime' | 'endTime'>) {
  if (!a.startTime && !a.endTime) return null
  return `${formatWallTime(a.startTime)}–${formatWallTime(a.endTime)}`
}

/** Status kegiatan dengan label yang sesuai konteks: Final = sudah terlaksana/dikunci. */
export function ActivityStatusBadge({ status }: { status: ExtraActivity['status'] }) {
  return <StatusBadge meta={ACTIVITY_STATUS_META} value={status} />
}

const ACTIVITY_STATUS_META = {
  DRAFT: { label: 'Terjadwal', tone: 'neutral' },
  SUBMITTED: { label: 'Dikirim', tone: 'info' },
  FINAL: { label: 'Final', tone: 'success' },
  REJECTED: { label: 'Ditolak', tone: 'danger' },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
} as const satisfies Record<ExtraActivity['status'], { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' }>

export const ACTIVITY_STATUS_OPTIONS = (['DRAFT', 'FINAL'] as const).map((value) => ({
  value,
  label: ACTIVITY_STATUS_META[value].label,
}))
