const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function trapDialogTab(event: KeyboardEvent, dialog: HTMLElement | null) {
  if (event.key !== 'Tab' || !dialog) return

  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  )
  const first = focusable[0]
  const last = focusable.at(-1)

  if (!first || !last) {
    event.preventDefault()
    dialog.focus()
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

export function makeBackgroundInert(modalRoot: HTMLElement | null) {
  if (!modalRoot) return () => {}

  const changed: Array<{ element: HTMLElement; inert: boolean }> = []
  let branch: HTMLElement = modalRoot
  while (branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (sibling === branch || !(sibling instanceof HTMLElement)) continue
      changed.push({ element: sibling, inert: Boolean(sibling.inert) })
      sibling.inert = true
    }
    if (branch.parentElement === document.body) break
    branch = branch.parentElement
  }

  return () => {
    for (const { element, inert } of changed) element.inert = inert
  }
}
