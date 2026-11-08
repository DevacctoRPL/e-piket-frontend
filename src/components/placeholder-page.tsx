import { Construction } from 'lucide-react'
import { EmptyState, Page, PageHeader } from '@/components/page'

/** Halaman sementara saat fitur belum diimplementasikan. */
export function PlaceholderPage({ title, description }: { title: string; description?: string }) {
  return (
    <Page>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={<Construction className="size-5" />}
        title="Sedang dikembangkan"
        description="Halaman ini akan segera tersedia."
      />
    </Page>
  )
}
