import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/admin/ui/page-header'

type ModulePlaceholderProps = {
  title: string
  description: string
  phaseHint?: string
}

/** Shell-only destination for modules that land in later phases. */
export function ModulePlaceholder({
  title,
  description,
  phaseHint = 'Module này sẽ được triển khai ở phase sau. Sidebar và permission đã sẵn sàng.',
}: ModulePlaceholderProps) {
  return (
    <section>
      <PageHeader title={title} description={description} />
      <EmptyState title="Sắp có" description={phaseHint} />
    </section>
  )
}
