// Simple functional tree renderer for the projection.
// Renders transposition badges that can jump (caller supplies the jump handler).

/**
 * Render a TreeNode projection into a DOM element.
 * @param {HTMLElement} container
 * @param {import('../model/project.js').TreeNode} node
 * @param {(fen: string) => void} onJump
 * @param {number} [depth]
 */
export function renderTree (container, node, onJump, depth = 0) {
  const div = document.createElement('div')
  div.style.marginLeft = (depth * 16) + 'px'
  div.style.fontFamily = 'ui-monospace, monospace'
  div.style.fontSize = '14px'
  div.style.padding = '2px 0'

  const label = document.createElement('span')
  label.textContent = (node.san || 'start') + (node.isTransposition ? ' ⇄' : '')
  label.style.cursor = 'pointer'
  if (node.isTransposition) {
    label.style.background = 'rgba(255,255,255,0.08)'
    label.title = 'Transposition — click to jump'
    label.onclick = () => onJump(node.transpositionTarget?.fen || node.fen)
  }
  div.appendChild(label)

  if (!node.isTransposition) {
    for (const child of node.children) {
      renderTree(div, child, onJump, depth + 1)
    }
  }

  container.appendChild(div)
}

/**
 * Clear and re-render.
 * @param {HTMLElement} container
 * @param {import('../model/project.js').TreeNode} root
 * @param {(fen: string) => void} onJump
 */
export function refreshTree (container, root, onJump) {
  container.innerHTML = ''
  renderTree(container, root, onJump)
}
