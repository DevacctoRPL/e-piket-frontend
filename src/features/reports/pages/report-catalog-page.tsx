import { ChevronRight, FileBarChart } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader } from '@/components/page'
import { useAuth } from '@/features/auth/auth-context'
import { REPORTS } from '../catalog'

/** Katalog laporan: hanya laporan yang boleh dilihat role (PRD §4.1). */
export function ReportCatalogPage() {
  const { can } = useAuth()
  const visible = REPORTS.filter((r) => can(r.permission))
  return (
    <Page>
      <PageHeader
        title="Laporan"
        description="Rekap resmi dari data yang sudah dikirim/final. Setiap laporan dapat difilter, ditelusuri ke data asal, diekspor, dan dicetak."
      />
      {visible.length === 0 ? (
        <EmptyState
          title="Belum ada laporan untuk peran Anda"
          description="Akun Anda belum memiliki akses ke data sumber laporan. Hubungi admin sekolah bila Anda memerlukan akses."
          icon={<FileBarChart className="size-5" />}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((r) => (
            <li key={r.path}>
              <Link
                to={r.path}
                className="group flex h-full items-start gap-3 rounded-xl border bg-card p-4 shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <r.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block font-semibold">{r.title}</span>
                  <span className="block text-sm text-pretty text-muted-foreground">{r.description}</span>
                </span>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
