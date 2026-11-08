import { Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/features/master-data/lookups'
import { formatDateLong, formatDateTime, todayISO, toISODateTime } from '@/lib/date'
import { cn } from '@/lib/utils'

/**
 * Kerangka dokumen cetak menyerupai buku (PRD §13.1): kop sekolah yang dapat dikonfigurasi,
 * nama formulir, tanggal/shift, isi, ruang pengesahan, dan waktu pembuatan.
 * Gunakan "Simpan sebagai PDF" di dialog cetak browser untuk ekspor PDF.
 */
export function PrintDocument({
  title,
  subtitle,
  meta,
  children,
  signatures,
  className,
}: {
  title: string
  subtitle?: ReactNode
  /** Baris informasi di bawah judul, mis. [['Hari/Tanggal', '...'], ['Shift', 'Pagi']] */
  meta?: [string, ReactNode][]
  children: ReactNode
  /** Kolom pengesahan, mis. [{ role: 'Guru Piket', name: 'Agus' }] */
  signatures?: { role: string; name?: string | null; nip?: string | null; place?: string }[]
  className?: string
}) {
  const settings = useSettings()
  const s = settings.data
  return (
    <article
      className={cn(
        'mx-auto w-full max-w-[210mm] bg-white p-6 text-[13px] leading-snug text-black shadow-sm print:max-w-none print:p-0 print:shadow-none sm:p-10',
        className,
      )}
    >
      <header className="border-b-[3px] border-double border-black pb-3 text-center">
        {(s?.letterheadLines ?? ['Kop sekolah']).map((line, i) => (
          <p key={i} className={cn(i === 2 ? 'text-lg font-bold' : 'text-sm font-semibold', i === 3 && 'font-normal text-xs')}>
            {line}
          </p>
        ))}
      </header>
      <div className="mt-4 text-center">
        <h1 className="text-base font-bold tracking-wide uppercase">{title}</h1>
        {subtitle && <p className="text-sm">{subtitle}</p>}
      </div>
      {meta && meta.length > 0 && (
        <table className="mt-4 text-sm">
          <tbody>
            {meta.map(([k, v]) => (
              <tr key={k}>
                <td className="pr-2 align-top whitespace-nowrap">{k}</td>
                <td className="pr-2 align-top">:</td>
                <td className="align-top font-medium">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4 space-y-4">{children}</div>
      {signatures && signatures.length > 0 && (
        <footer className="mt-10 grid gap-8 break-inside-avoid" style={{ gridTemplateColumns: `repeat(${signatures.length}, minmax(0, 1fr))` }}>
          {signatures.map((sig, i) => (
            <div key={i} className="text-center text-sm">
              <p>{i === signatures.length - 1 ? `${sig.place ?? s?.city ?? ''}, ${formatDateLong(todayISO())}` : ' '}</p>
              <p>{sig.role}</p>
              <div className="h-16" />
              <p className="font-semibold underline">{sig.name ?? '(..............................)'}</p>
              {sig.nip && <p>NIP. {sig.nip}</p>}
            </div>
          ))}
        </footer>
      )}
      <p className="mt-8 text-[10px] text-gray-500">
        Dicetak dari sistem pada {formatDateTime(toISODateTime())}. Pengesahan digital: identitas akun & waktu tercatat di sistem.
      </p>
    </article>
  )
}

/** Tabel bergaya formulir buku (garis penuh). */
export function PrintTable({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <table
      className={cn(
        'w-full border-collapse text-[12px] [&_td]:border [&_td]:border-black [&_td]:px-1.5 [&_td]:py-1 [&_th]:border [&_th]:border-black [&_th]:bg-gray-100 [&_th]:px-1.5 [&_th]:py-1 [&_th]:text-center [&_th]:font-semibold [&_thead]:table-header-group [&_tr]:break-inside-avoid',
        className,
      )}
      {...props}
    />
  )
}

export function PrintButton({ label = 'Cetak / PDF' }: { label?: string }) {
  return (
    <Button variant="outline" onClick={() => window.print()} className="no-print">
      <Printer /> {label}
    </Button>
  )
}
