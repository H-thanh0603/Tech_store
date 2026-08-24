import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { JsonLd } from '@/components/seo/json-ld'

describe('JsonLd', () => {
  it('cannot be terminated by an admin-controlled script closing tag', () => {
    const html = renderToStaticMarkup(
      <JsonLd data={{ name: '</script><script>alert("stored-xss")</script>' }} nonce="test-nonce" />,
    )

    expect(html).not.toContain('</script><script>')
    expect(html).toContain('\\u003c/script>')
    expect(html).toContain('nonce="test-nonce"')
  })
})
