import { renderSection } from '@/components/home/sections'
import type { HomeSectionContext } from '@/components/home/sections/types'
import type { HomepageSection } from '@/lib/content/types'

type HomePageViewProps = {
  sections: HomepageSection[]
  context: HomeSectionContext
}

/**
 * Homepage host.
 *
 * It owns no layout decisions beyond stacking: the order, copy and presence of
 * every band comes from `homepage_sections`, and each row is rendered by the
 * component the registry maps its type to. Adding a band is a database row plus
 * a renderer, never an edit to this file.
 */
export function HomePageView({ sections, context }: HomePageViewProps) {
  if (sections.length === 0) {
    return (
      <div className="container-store section-y">
        <div className="surface-panel p-8">
          <p className="font-semibold">Trang chủ chưa có nội dung</p>
          <p className="mt-1 text-(length:--text-sm) text-fg-muted">
            Chạy migration và seed nội dung (bảng <code>homepage_sections</code>) để hiển thị các
            khu vực trang chủ.
          </p>
        </div>
      </div>
    )
  }

  return <div className="flex flex-col">{sections.map((section) => renderSection(section, context))}</div>
}
