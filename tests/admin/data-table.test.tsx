// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataTable, type DataTableColumn } from '@/components/admin/ui/data-table'

type Row = { id: string; name: string }

const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Tên', cell: (row) => row.name },
]

describe('DataTable', () => {
  it('renders loading skeleton', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        loading
      />,
    )
    expect(screen.getByRole('status', { name: 'Đang tải bảng' })).toBeInTheDocument()
  })

  it('renders empty state', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        emptyTitle="Chưa có dữ liệu"
        emptyDescription="Thử đổi bộ lọc."
      />,
    )
    expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument()
    expect(screen.getByText('Thử đổi bộ lọc.')).toBeInTheDocument()
  })

  it('renders error state', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        error="Không kết nối được database"
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Không kết nối được database')
  })

  it('renders data rows', () => {
    render(
      <DataTable
        columns={columns}
        rows={[
          { id: '1', name: 'iPhone 15' },
          { id: '2', name: 'Galaxy S24' },
        ]}
        getRowId={(r) => r.id}
        caption="Sản phẩm"
      />,
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('iPhone 15')).toBeInTheDocument()
    expect(screen.getByText('Galaxy S24')).toBeInTheDocument()
  })
})
