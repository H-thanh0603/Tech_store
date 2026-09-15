// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AgentActivityList } from '@/components/assistant/agent-activity-list'
import type { AgentCall } from '@/lib/assistant/activity'

function call(tool: string, label: string, detail?: string): AgentCall {
  return { tool, label, kind: 'lookup', ...(detail ? { detail } : {}) }
}

describe('AgentActivityList', () => {
  it('renders each streamed agent step with its label and detail', () => {
    render(
      <AgentActivityList
        calls={[
          call('search_products', 'Tìm sản phẩm trong catalog', 'laptop gaming'),
          call('compare_products', 'So sánh sản phẩm', 'so sánh 3 món'),
        ]}
      />,
    )
    const list = screen.getByLabelText('Các bước trợ lý đang làm')
    expect(list).toHaveTextContent('Tìm sản phẩm trong catalog: laptop gaming')
    expect(list).toHaveTextContent('So sánh sản phẩm: so sánh 3 món')
  })

  it('stays hidden when no tool has run yet', () => {
    const { container } = render(<AgentActivityList calls={[]} />)
    expect(container.querySelector('[aria-label="Các bước trợ lý đang làm"]')).toBeNull()
  })

  it('caps the checklist at the 6 most recent steps', () => {
    const calls = Array.from({ length: 8 }, (_, i) =>
      call('get_product_details', `Xem chi tiết sản phẩm ${i + 1}`),
    )
    const { container } = render(<AgentActivityList calls={calls} />)
    const rows = container.querySelectorAll('[aria-label="Các bước trợ lý đang làm"] > div')
    expect(rows).toHaveLength(6)
    expect(container).toHaveTextContent('Xem chi tiết sản phẩm 8')
    expect(container).not.toHaveTextContent('Xem chi tiết sản phẩm 1')
  })
})
