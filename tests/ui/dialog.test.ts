// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { makeBackgroundInert, trapDialogTab } from '@/lib/a11y/dialog'

describe('trapDialogTab', () => {
  it('wraps focus from the last element to the first', () => {
    const dialog = document.createElement('div')
    const first = document.createElement('button')
    const last = document.createElement('button')
    dialog.append(first, last)
    document.body.append(dialog)
    last.focus()

    trapDialogTab(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }), dialog)

    expect(document.activeElement).toBe(first)
    dialog.remove()
  })

  it('makes the page branch outside the modal inert and restores it', () => {
    const background = document.createElement('main')
    const modal = document.createElement('div')
    document.body.append(background, modal)

    const restore = makeBackgroundInert(modal)
    expect(background.inert).toBe(true)

    restore()
    expect(background.inert).toBe(false)
    background.remove()
    modal.remove()
  })
})
