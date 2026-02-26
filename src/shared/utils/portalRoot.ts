/**
 * Dedicated portal container for React portals.
 *
 * Using `document.body` directly as a portal target can cause
 * "Failed to execute 'insertBefore' on 'Node'" errors when browser
 * extensions or other scripts also modify document.body's children.
 *
 * This module lazily creates and caches a single <div id="portal-root">
 * appended to document.body that React fully owns.
 */

let portalRoot: HTMLElement | null = null

export function getPortalRoot(): HTMLElement {
  if (!portalRoot) {
    portalRoot = document.getElementById('portal-root')
    if (!portalRoot) {
      portalRoot = document.createElement('div')
      portalRoot.id = 'portal-root'
      document.body.appendChild(portalRoot)
    }
  }
  return portalRoot
}
