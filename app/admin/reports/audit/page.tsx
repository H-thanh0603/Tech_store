import { DataTable, type DataTableColumn } from '@/components/admin/ui/data-table'
import { FilterBar, FilterChip } from '@/components/admin/ui/filter-bar'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'

// Audit log listing with entity-type filter + CSV export.

const ENTITY_TYPES = ['all', 'coupon', 'product', 'order'] as const
const PAGE_SIZE = 50

interface AuditRow {
  id: string
  action: string
  entityType: string
  entityId: string | null
  payload: Record<string, unknown>
  actorLabel: string
  createdAt: string
}

function buildQs(parts: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(parts)) {
    if (value === undefined || value === '' || value === 'all') continue
    if (key === 'page' && Number(value) <= 1) continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity_type?: string; page?: string }>
}) {
  const access = await requireAdminModule('reports')
  if (isForbidden(access)) return <PermissionDeniedState />

  const { entity_type: entityTypeRaw, page: pageRaw } = await searchParams
  const entityType = (ENTITY_TYPES as readonly string[]).includes(entityTypeRaw ?? '')
    ? entityTypeRaw!
    : 'all'
  const page = Math.max(1, Number(pageRaw ?? 1) || 1)

  const { data, error } = await getSupabaseAdminClient().rpc('admin_list_audit_logs', {
    p_entity_type: entityType === 'all' ? null : entityType,
    p_action: null,
    p_from: null,
    p_to: null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  })

  const result = data as { total?: number; rows?: AuditRow[] } | null
  const rows = result?.rows ?? []
  const total = result?.total ?? 0
  const pageCount = Math.max(Math.ceil(total / PAGE_SIZE), 1)

  const columns: DataTableColumn<AuditRow>[] = [
    {
      id: 'createdAt',
      header: 'Thời gian',
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums text-fg-muted">
          {new Date(row.createdAt).toLocaleString('vi-VN')}
        </span>
      ),
    },
    { id: 'action', header: 'Hành động', cell: (row) => <code className="text-(length:--text-xs)">{row.action}</code> },
    { id: 'entityType', header: 'Đối tượng', cell: (row) => row.entityType },
    {
      id: 'entityId',
      header: 'ID',
      hideOnMobile: true,
      cell: (row) => (
        <span className="max-w-40 truncate font-mono text-(length:--text-xs) text-fg-muted">
          {row.entityId ?? '—'}
        </span>
      ),
    },
    { id: 'actorLabel', header: 'Người thực hiện', cell: (row) => row.actorLabel },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description={`${total} bản ghi · xuất CSV để lưu trữ hoặc kiểm tra`}
      />
      <DataTable
        caption="Audit log quản trị"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        error={error ? error.message : null}
        totalCount={total}
        page={page}
        pageCount={pageCount}
        hrefForPage={(p) => `/admin/reports/audit${buildQs({ entity_type: entityType, page: p })}`}
        toolbar={
          <FilterBar
            actions={
              <a
                href={`/api/admin/audit/export${entityType === 'all' ? '' : `?entity_type=${entityType}`}`}
                className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-border bg-bg-elevated px-4 text-(length:--text-sm) font-semibold text-fg hover:border-brand/50"
              >
                Xuất CSV
              </a>
            }
          >
            {ENTITY_TYPES.map((type) => (
              <FilterChip
                key={type}
                href={`/admin/reports/audit${buildQs({ entity_type: type })}`}
                active={entityType === type}
              >
                {type === 'all' ? 'Tất cả' : type}
              </FilterChip>
            ))}
          </FilterBar>
        }
      />
    </div>
  )
}
