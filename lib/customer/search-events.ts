/**
 * Tiny event bridge so any component can ask the header search to open.
 *
 * A DOM event keeps the two features decoupled: the bottom navigation does not
 * need a shared provider, a ref, or its own copy of the search UI.
 */

const OPEN_SEARCH = 'techstore:open-search'

export function openSearch() {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new CustomEvent(OPEN_SEARCH))
}

export function subscribeOpenSearch(handler: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  window.addEventListener(OPEN_SEARCH, handler)
  return () => window.removeEventListener(OPEN_SEARCH, handler)
}
