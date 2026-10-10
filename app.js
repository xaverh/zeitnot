'use strict'

import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js'
import { Chessboard, INPUT_EVENT_TYPE, COLOR } from 'https://cdn.jsdelivr.net/npm/cm-chessboard@8.15.3/src/Chessboard.js'
import { Markers, MARKER_TYPE } from 'https://cdn.jsdelivr.net/npm/cm-chessboard@8.15.3/src/extensions/markers/Markers.js'
import { Arrows, ARROW_TYPE } from 'https://cdn.jsdelivr.net/npm/cm-chessboard@8.15.3/src/extensions/arrows/Arrows.js'

/* global Audio, FileReader */

const CHESSBOARD_ASSETS = 'https://cdn.jsdelivr.net/npm/cm-chessboard@8.15.3/assets/'

const StatisticType = {
  RIGHT_MOVE: 1,
  WRONG_MOVE: 2,
  FINISH_LINE: 3
}

function assert (x) {
  if (!x) {
    throw new Error('Expected non-null and non-undefined.')
  }
  return x
}

function ViewList () {
  this.views = []
}
ViewList.prototype.addView = function (view) {
  this.views.push(view)
}
ViewList.prototype.refresh = function () {
  this.views.forEach(v => v.refresh())
}

const ModeType = {
  BUILD: 'buildMode',
  STUDY: 'studyMode',
  EVALUATE: 'evaluateMode'
}

const Config = {
  OPPONENT_FIRST_MOVE_DELAY_MS: 600,
  OPPONENT_REPLY_DELAY_MS: 600,
  WRONG_MOVES_FOR_ANSWER: 2,
  WRONG_MOVES_FOR_HINT: 1,
  MAXIMUM_LINE_DEPTH_IN_PLY: 80,
  MAXIMUM_TREE_NODES_PER_REPERTOIRE: 5000
}

function showStatus (message) {
  const line = document.getElementById('status')
  if (line) line.textContent = message
}

function Debouncer (callback, intervalMs) {
  this.callback = callback
  this.intervalMs = intervalMs
  this.timeout = null
  this.firedDuringTimeout = false
}

Debouncer.prototype.fire = function () {
  if (this.timeout !== null) {
    this.firedDuringTimeout = true
    return
  }
  this.callback()
  this.firedDuringTimeout = false
  this.timeout = window.setTimeout(() => this.fireAfterTimeout(), this.intervalMs)
}

Debouncer.prototype.fireAfterTimeout = function () {
  this.timeout = null
  if (!this.firedDuringTimeout) return
  this.firedDuringTimeout = false
  this.fire()
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function OpeningBoard (boardEl, boardHandler, soundPlayer, viewOnly) {
  this.chessBoardElement = boardEl
  this.boardHandler = boardHandler
  this.soundPlayer = soundPlayer
  this.viewOnly = viewOnly
  if (!boardEl) throw new Error('Board element is missing.')
  this.board = new Chessboard(boardEl, {
    position: START_FEN,
    assetsUrl: CHESSBOARD_ASSETS,
    style: { borderType: 'none', animationDuration: 200 },
    extensions: [{ class: Markers }, { class: Arrows }]
  })
  this.board.view.container.classList.add('sharechess-board')
  window.shareChessBoards = window.shareChessBoards || []
  window.shareChessBoards.push(this.board)
  if (!viewOnly) this.board.enableMoveInput((event) => this.onMoveInput(event))
  boardEl.onwheel = (e) => boardHandler.onScroll(e)
}
OpeningBoard.prototype.onMoveInput = function (event) {
  if (event.type === INPUT_EVENT_TYPE.moveInputFinished) {
    this.boardHandler.onMove(event.squareFrom, event.squareTo)
    this.boardHandler.onChange()
  }
  return true
}
OpeningBoard.prototype.setStateFromChess = function (chess) {
  const history = chess.history({ verbose: true })
  const lastChessMove = history[history.length - 1]
  this.board.setPosition(chess.fen())
  this.removeDrawings()
  if (!this.soundPlayer || !lastChessMove) return
  if (lastChessMove.san.includes('x')) this.soundPlayer.playCapture()
  else this.soundPlayer.playMove()
}
OpeningBoard.prototype.setInitialPositionImmediately = function () {
  this.board.setPosition(START_FEN)
  this.removeDrawings()
}
OpeningBoard.prototype.setOrientationForColor = function (color) {
  const orientation = color === 'w' ? COLOR.white : COLOR.black
  if (this.board.getOrientation() === orientation) return
  this.board.setOrientation(orientation)
}
OpeningBoard.prototype.flashRightMove = function () {
  this.flashClassName('rightMove')
}
OpeningBoard.prototype.flashWrongMove = function () {
  this.flashClassName('wrongMove')
  this.soundPlayer.playWrongMove()
}
OpeningBoard.prototype.flashFinishLine = function () {
  this.flashClassName('finishLine')
  this.soundPlayer.playFinishLine()
}
OpeningBoard.prototype.drawCircle = function (square, color) {
  this.board.addMarker(color === 'red' ? MARKER_TYPE.square : MARKER_TYPE.frame, square)
}
OpeningBoard.prototype.drawArrow = function (fromSquare, toSquare, color) {
  const type = color === 'red' ? ARROW_TYPE.danger : ARROW_TYPE.success
  this.board.addArrow(type, fromSquare, toSquare)
}
OpeningBoard.prototype.removeDrawings = function () {
  this.board.removeMarkers()
  this.board.removeArrows()
}
OpeningBoard.prototype.flashClassName = function (className) {
  this.chessBoardElement.classList.remove(className)
  if (this.chessBoardElement.offsetWidth >= 0) {
    this.chessBoardElement.classList.add(className)
  }
}

function EmptyMessage (treeModel, emptyEl) {
  this.treeModel = treeModel
  this.emptyEl = emptyEl
}
EmptyMessage.prototype.refresh = function () {
  const hideEmptyMessage = !this.treeModel.isEmpty()
  this.emptyEl.classList.toggle('hidden', hideEmptyMessage)
}

function TreeButtons (buttonsEl, treeModel) {
  this.buttonsEl = buttonsEl
  this.treeModel = treeModel
  this.buttons = []
}
TreeButtons.prototype.refresh = function () {
  // Show/hide the button container as necessary.
  const isModelEmpty = this.treeModel.isEmpty()
  this.buttonsEl.classList.toggle('hidden', isModelEmpty)
  // Show/hide the individual buttons.
  this.buttons.forEach(b => {
    const enabled = b.isEnabled()
    b.buttonEl.classList.toggle('disabled', !enabled)
    b.buttonEl.classList.toggle('selectable', enabled)
  })
}
TreeButtons.prototype.addButton = function (treeButton) {
  treeButton.buttonEl.onclick = () => treeButton.handleClick()
  this.buttons.push(treeButton)
  return this
}
TreeButtons.prototype.addNavigationButtons = function (leftButtonEl, rightButtonEl, treeNavigator) {
  return this
    .addButton({
      buttonEl: leftButtonEl,
      handleClick: () => treeNavigator.selectLeft(),
      isEnabled: () => this.treeModel.hasPreviousPgn()
    })
    .addButton({
      buttonEl: rightButtonEl,
      handleClick: () => treeNavigator.selectRight(),
      isEnabled: () => this.treeModel.hasNextPgn()
    })
}

function NullAnnotator () {}
NullAnnotator.prototype.annotate = function () {
  return null
}

NullAnnotator.INSTANCE = new NullAnnotator()

const AddMoveFailureReason = {
  ILLEGAL_MOVE: 1,
  EXCEEDED_MAXIMUM_LINE_DEPTH: 2,
  EXCEEDED_MAXIMUM_NUM_NODES: 3
}

function normalizeFen (fen, numLegalMoves) {
  // Drop half-move counts and en passant. Append the legal-move count so those positions stay distinct.
  return fen.split(' ').slice(0, 3).join(' ') + numLegalMoves
}

function TreeNode (parent, fen, pgn, numLegalMoves, lastMove, lastMoveString, depth) {
  this.parent = parent
  this.fen = fen
  this.pgn = pgn
  this.numLegalMoves = numLegalMoves
  this.colorToMove = depth % 2 === 0 ? 'w' : 'b'
  this.lastMove = lastMove
  this.lastMoveString = lastMoveString || '🏁'
  this.lastMoveNumber = Math.floor((depth + 1) / 2)
  this.lastMoveColor = depth % 2 === 1 ? 'w' : 'b'
  this.lastMoveVerboseString = lastMoveString
    ? (this.lastMoveColor === 'w'
        ? this.lastMoveNumber + '. ' + this.lastMoveString
        : this.lastMoveNumber + '... ' + this.lastMoveString)
    : '🏁 (start)'
  this.depth = depth
  this.children = []
}
TreeNode.prototype.addChild = function (position, pgn, numLegalMoves, lastMove, lastMoveString) {
  const child = new TreeNode(this, position, pgn, numLegalMoves, lastMove, lastMoveString, this.depth + 1)
  this.children.push(child)
  return child
}
TreeNode.prototype.removeChildPgn = function (pgnToRemove) {
  for (let i = 0; i < this.children.length; i++) {
    if (this.children[i].pgn === pgnToRemove) {
      this.children.splice(i, 1)
      return
    }
  }
}
TreeNode.prototype.createViewInfo = function (selectedNode, pgnToNode, fenToPgn, repertoireColor, annotator) {
  return {
    position: this.fen,
    pgn: this.pgn,
    parentPgn: this.parent ? this.parent.pgn : null,
    numLegalMoves: this.numLegalMoves,
    colorToMove: this.colorToMove,
    lastMove: this.lastMove,
    lastMoveString: this.lastMoveString,
    lastMoveVerboseString: this.lastMoveVerboseString,
    lastMovePly: this.depth,
    lastMoveNumber: this.lastMoveNumber,
    lastMoveColor: this.lastMoveColor,
    numChildren: this.children.length,
    childPgns: this.children.map(c => c.pgn),
    childMoves: this.children.map(c => c.lastMove),
    isSelected: this.pgn === selectedNode.pgn,
    annotation: annotator.annotate(this, repertoireColor, pgnToNode, fenToPgn)
  }
}
TreeNode.prototype.getParentOrSelf = function () {
  return this.parent ? this.parent : this
}
TreeNode.prototype.getFirstChildOrSelf = function () {
  return this.children.length ? this.children[0] : this
}
TreeNode.prototype.getPreviousSiblingOrSelf = function (stopWithManyChildren) {
  if (!this.parent) {
    return this
  }
  if (this.parent.children.length === 1) {
    return this.parent.getPreviousSiblingOrSelf(true)
  }
  if (stopWithManyChildren) {
    return this
  }
  for (let i = 1; i < this.parent.children.length; i++) {
    if (this === this.parent.children[i]) {
      return this.parent.children[i - 1]
    }
  }
  return this.parent
}
TreeNode.prototype.getNextSiblingOrSelf = function (stopWithManyChildren) {
  if (this.parent && this.parent.children.length > 1) {
    for (let i = 0; i < this.parent.children.length - 1; i++) {
      if (this === this.parent.children[i]) {
        return this.parent.children[i + 1]
      }
    }
  }
  if (this.children.length === 1) {
    return this.children[0].getNextSiblingOrSelf(true)
  }
  if (stopWithManyChildren) {
    return this
  }
  return this.children.length ? this.children[0] : this
}
TreeNode.prototype.traverseDepthFirst = function (callback, selectedNode, pgnToNode, fenToPgn, repertoireColor, annotator) {
  callback(this.createViewInfo(selectedNode, pgnToNode, fenToPgn, repertoireColor, annotator))
  this.children.forEach(child => child.traverseDepthFirst(callback, selectedNode, pgnToNode, fenToPgn, repertoireColor, annotator))
}
TreeNode.prototype.exportChildrenToPgn = function (forceFirstChildVerbose) {
  if (!this.children.length) {
    return ''
  }
  const firstChild = this.children[0]
  let ans = forceFirstChildVerbose || firstChild.lastMoveColor === 'w'
    ? firstChild.lastMoveVerboseString
    : firstChild.lastMoveString
  for (let i = 1; i < this.children.length; i++) {
    const otherChild = this.children[i]
    const otherChildContinuation = otherChild.exportChildrenToPgn(false)
    ans += ' (' + otherChild.lastMoveVerboseString
    if (otherChildContinuation) {
      ans += ' ' + otherChildContinuation
    }
    ans += ')'
  }
  const firstChildForceVerbose = this.children.length > 1
  const firstChildContinuation = firstChild.exportChildrenToPgn(firstChildForceVerbose)
  if (firstChildContinuation) {
    ans += ' ' + firstChildContinuation
  }
  return ans
}
TreeNode.prototype.serializeRepertoireNode = function () {
  return {
    pgn: this.pgn,
    fen: this.fen,
    nlm: this.numLegalMoves,
    ctm: this.colorToMove === 'w' ? 'w' : 'b',
    lmf: this.lastMove ? this.lastMove.fromSquare : '',
    lmt: this.lastMove ? this.lastMove.toSquare : '',
    lms: this.lastMoveString || '',
    c: this.children.map(c => c.serializeRepertoireNode())
  }
}

function TreeModel () {
  this.repertoireColor = 'w'
  this.repertoireName = ''

  this.chess = null
  this.rootNode = null
  this.selectedNode = null
  this.pgnToNode = {}
  this.fenToPgn = {}
  this.numNodes = 0
  this.makeEmpty()
}
TreeModel.prototype.getChessForState = function () {
  return this.chess
}
TreeModel.prototype.isEmpty = function () {
  if (!this.rootNode || !this.selectedNode) {
    throw new Error('Model not ready.')
  }
  const viewInfo = this.rootNode.createViewInfo(this.selectedNode, this.pgnToNode, this.fenToPgn, this.repertoireColor, NullAnnotator.INSTANCE)
  return !viewInfo.numChildren
}
TreeModel.prototype.addMove = function (pgn, move) {
  if (this.numNodes >= Config.MAXIMUM_TREE_NODES_PER_REPERTOIRE) {
    return {
      success: false,
      failureReason: AddMoveFailureReason.EXCEEDED_MAXIMUM_NUM_NODES
    }
  }
  if (!pgn) {
    this.chess.reset()
  }
  if (pgn) {
    try {
      this.chess.loadPgn(pgn)
    } catch (e) {
      throw new Error('Tried to add move from invalid PGN: ' + pgn)
    }
  }
  if (this.chess.history().length >= Config.MAXIMUM_LINE_DEPTH_IN_PLY) {
    return {
      success: false,
      failureReason: AddMoveFailureReason.EXCEEDED_MAXIMUM_LINE_DEPTH
    }
  }
  const chessMove = typeof move === 'string'
    ? move
    : {
        from: move.fromSquare,
        to: move.toSquare,
        promotion: 'q'
      }
  try {
    this.chess.move(chessMove)
  } catch (e) {
    return {
      success: false,
      failureReason: AddMoveFailureReason.ILLEGAL_MOVE
    }
  }
  const childPosition = this.chess.fen()
  const childPgn = this.getMoveText()
  let childNode = this.pgnToNode[childPgn]
  if (!childNode) {
    // This is a new position. Add it to the tree.
    const history = this.chess.history({ verbose: true })
    const lastMove = history[history.length - 1]
    childNode = this.addNewMove(pgn, childPosition, childPgn, this.chess.moves().length, {
      fromSquare: lastMove.from,
      toSquare: lastMove.to
    }, lastMove.san)
  }
  // Select the new child node.
  this.selectedNode = childNode
  // Phase 1 dual-write (fire-and-forget, does not affect return)
  try { shadowWriteAfterAdd(this, pgn, childPosition) } catch (e) { /* ignore */ }
  return {
    success: true,
    failureReason: null
  }
}
TreeModel.prototype.addNewMove = function (parentPgn, childPosition, childPgn, numLegalMoves, lastMove, lastMoveString) {
  const parentNode = this.pgnToNode[parentPgn]
  if (!parentNode) {
    throw new Error('No node exists for PGN: ' + parentPgn)
  }
  const childNode = parentNode.addChild(childPosition, childPgn, numLegalMoves, lastMove, lastMoveString)
  this.pgnToNode[childPgn] = childNode
  const normalizedFen = normalizeFen(childPosition, numLegalMoves)
  if (!this.fenToPgn[normalizedFen]) {
    this.fenToPgn[normalizedFen] = []
  }
  this.fenToPgn[normalizedFen].push(childPgn)
  this.numNodes++
  return childNode
}
TreeModel.prototype.canRemoveSelectedPgn = function () {
  if (!this.selectedNode) {
    throw new Error('Model not ready.')
  }
  return this.selectedNode.getParentOrSelf() !== this.selectedNode
}
TreeModel.prototype.removeSelectedPgn = function () {
  if (!this.selectedNode) {
    throw new Error('Model not ready.')
  }
  const nodeToDelete = this.selectedNode
  if (!nodeToDelete.pgn) {
    // Can't delete the start position.
    return
  }
  // Select the parent of the node to delete.
  this.selectedNode = nodeToDelete.getParentOrSelf()
  this.selectedNode.removeChildPgn(nodeToDelete.pgn)
  this.chess.loadPgn(this.selectedNode.pgn)
  // Remove all the descendent nodes from the PGN to node map.
  let numDeletedNodes = 0
  nodeToDelete.traverseDepthFirst(viewInfo => {
    delete this.pgnToNode[viewInfo.pgn]
    const normalizedFen = normalizeFen(viewInfo.position, viewInfo.numLegalMoves)
    if (!this.fenToPgn[normalizedFen]) {
      throw new Error('Unexpected state.')
    }
    this.fenToPgn[normalizedFen] = this.fenToPgn[normalizedFen]
      .filter(e => e !== viewInfo.pgn)
    numDeletedNodes++
  }, this.selectedNode, this.pgnToNode, this.fenToPgn, this.repertoireColor, NullAnnotator.INSTANCE)
  this.numNodes -= numDeletedNodes
}
TreeModel.prototype.traverseDepthFirst = function (callbackFn, annotator) {
  if (!this.rootNode || !this.selectedNode) {
    throw new Error('Model not ready.')
  }
  this.rootNode.traverseDepthFirst(callbackFn, this.selectedNode, this.pgnToNode, this.fenToPgn, this.repertoireColor, annotator)
}
TreeModel.prototype.flipRepertoireColor = function () {
  this.repertoireColor = this.repertoireColor === 'w' ? 'b' : 'w'
}
TreeModel.prototype.selectPgn = function (pgn) {
  if (!pgn) {
    this.chess.reset()
  }
  if (pgn) {
    try {
      this.chess.loadPgn(pgn)
    } catch (e) {
      throw new Error('Tried to select invalid PGN: ' + pgn)
    }
  }
  const node = this.pgnToNode[pgn]
  if (!node) {
    throw new Error('No node exists for PGN: ' + pgn)
  }
  this.selectedNode = node
}
TreeModel.prototype.hasPreviousPgn = function () {
  if (!this.selectedNode) {
    throw new Error('Model not ready.')
  }
  return this.selectedNode.getParentOrSelf() !== this.selectedNode
}
TreeModel.prototype.selectPreviousPgn = function () {
  if (!this.selectedNode) {
    throw new Error('Model not ready.')
  }
  this.selectedNode = this.selectedNode.getParentOrSelf()
  this.chess.loadPgn(this.selectedNode.pgn)
}
TreeModel.prototype.hasNextPgn = function () {
  if (!this.selectedNode) {
    throw new Error('Model not ready.')
  }
  return this.selectedNode.getFirstChildOrSelf() !== this.selectedNode
}
TreeModel.prototype.selectNextPgn = function () {
  if (!this.selectedNode) {
    throw new Error('Model not ready.')
  }
  this.selectedNode = this.selectedNode.getFirstChildOrSelf()
  this.chess.loadPgn(this.selectedNode.pgn)
}
TreeModel.prototype.hasPreviousSiblingPgn = function () {
  if (!this.selectedNode) {
    throw new Error('Model not ready.')
  }
  return this.selectedNode.getPreviousSiblingOrSelf(false) !== this.selectedNode
}
TreeModel.prototype.selectPreviousSiblingPgn = function () {
  if (!this.selectedNode) {
    throw new Error('Model not ready.')
  }
  this.selectedNode = this.selectedNode.getPreviousSiblingOrSelf(false)
  this.chess.loadPgn(this.selectedNode.pgn)
}
TreeModel.prototype.hasNextSiblingPgn = function () {
  if (!this.selectedNode) {
    throw new Error('Model not ready.')
  }
  return this.selectedNode.getNextSiblingOrSelf(false) !== this.selectedNode
}
TreeModel.prototype.selectNextSiblingPgn = function () {
  if (!this.selectedNode) {
    throw new Error('Model not ready.')
  }
  this.selectedNode = this.selectedNode.getNextSiblingOrSelf(false)
  this.chess.loadPgn(this.selectedNode.pgn)
}
TreeModel.prototype.getSelectedViewInfo = function (annotator) {
  if (!this.selectedNode) {
    throw new Error('Model not ready.')
  }
  return this.selectedNode.createViewInfo(this.selectedNode, this.pgnToNode, this.fenToPgn, this.repertoireColor, annotator)
}
TreeModel.prototype.serializeRepertoire = function () {
  if (!this.rootNode) {
    throw new Error('Model not ready.')
  }
  return {
    name: this.repertoireName,
    color: this.repertoireColor,
    root: this.rootNode.serializeRepertoireNode()
  }
}
TreeModel.prototype.exportToPgn = function () {
  if (!this.rootNode) {
    throw new Error('Model not ready.')
  }
  const rootPgn = this.rootNode.exportChildrenToPgn(false)
  return rootPgn ? rootPgn + ' *' : '*'
}
TreeModel.prototype.makeEmpty = function () {
  this.chess = new Chess()
  const initialFen = normalizeFen(this.chess.fen(), this.chess.moves().length)
  const initialPgn = this.getMoveText()
  this.rootNode = new TreeNode(null /* parent */, initialFen, initialPgn, this.chess.moves().length, null, '', 0)
  this.pgnToNode = {}
  this.pgnToNode[initialPgn] = this.rootNode
  this.fenToPgn = {}
  this.fenToPgn[initialFen] = [initialPgn]
  this.selectedNode = this.rootNode
  this.repertoireColor = 'w'
  this.numNodes = 1
}
TreeModel.prototype.getMoveText = function () {
  if (!this.chess.history().length) {
    return ''
  }
  return this.chess.pgn()
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/(?:^|\s)(?:\*|1-0|0-1|1\/2-1\/2)\s*$/, '')
    .trim()
}
TreeModel.prototype.loadRepertoire = function (repertoire) {
  this.makeEmpty()
  if (repertoire) {
    this.repertoireName = repertoire.name
    this.repertoireColor = repertoire.color
    if (repertoire.root) {
      this.parseRecursive(repertoire.root)
    }
  }
  this.selectPgn('')
  // Phase 1 dual-write of the whole repertoire (fire-and-forget)
  try { shadowWriteRepertoire(this, repertoire) } catch (e) { /* ignore */ }
}
TreeModel.prototype.parseRecursive = function (node) {
  const children = node.children || node.c
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    this.addNewMove(node.pgn, child.fen, child.pgn, child.nlm, {
      fromSquare: child.lmf,
      toSquare: child.lmt
    }, child.lms)
    this.parseRecursive(child)
  }
}

function TreeNavigator (treeModel, modeView) {
  this.treeModel = treeModel
  this.modeView = modeView
}
TreeNavigator.prototype.selectLeft = function () {
  if (this.treeModel.hasPreviousPgn()) {
    this.treeModel.selectPreviousPgn()
    this.modeView.refresh()
  }
}
TreeNavigator.prototype.selectRight = function () {
  if (this.treeModel.hasNextPgn()) {
    this.treeModel.selectNextPgn()
    this.modeView.refresh()
  }
}
TreeNavigator.prototype.selectDown = function () {
  if (this.treeModel.hasNextSiblingPgn()) {
    this.treeModel.selectNextSiblingPgn()
    this.modeView.refresh()
  }
}
TreeNavigator.prototype.selectUp = function () {
  if (this.treeModel.hasPreviousSiblingPgn()) {
    this.treeModel.selectPreviousSiblingPgn()
    this.modeView.refresh()
  }
}
TreeNavigator.prototype.selectFromWheelEvent = function (e) {
  if (e.deltaY < 0) {
    this.selectLeft()
  } else if (e.deltaY > 0) {
    this.selectRight()
  }
  e.preventDefault()
}

function TreeNodeHandler (treeModel, modeView) {
  this.treeModel = treeModel
  this.modeView = modeView
}
TreeNodeHandler.prototype.onClick = function (pgn) {
  this.treeModel.selectPgn(pgn)
  this.modeView.refresh()
}

const treeClasses = {
  DISABLED: 'disabled',
  HIDDEN: 'hidden',
  SELECTABLE: 'selectable',
  NODE: 'treeViewNode',
  SELECTED_NODE: 'selectedNode',
  ROW: 'treeViewRow',
  SEGMENT: 'treeViewSegment',
  TREE_VIEW_INNER: 'treeViewInner',
  TREE_VIEW_OUTER: 'treeViewOuter'
}
function TreeView (treeViewInnerElement, treeViewOuterElement, treeModel, treeNodeHandler, board, annotator, annotationRenderer) {
  this.treeViewInnerElement = treeViewInnerElement
  this.treeViewOuterElement = treeViewOuterElement
  this.treeModel = treeModel
  this.treeNodeHandler = treeNodeHandler
  this.board = board
  this.annotator = annotator
  this.annotationRenderer = annotationRenderer
  treeViewInnerElement.classList.add(treeClasses.TREE_VIEW_INNER)
  treeViewOuterElement.classList.add(treeClasses.TREE_VIEW_OUTER)
}
TreeView.prototype.refresh = function () {
  this.treeViewInnerElement.innerHTML = ''
  const state = new TraversalState()
  // Show/hide the empty tree element as necessary.
  const isModelEmpty = this.treeModel.isEmpty()
  this.treeViewOuterElement.classList.toggle(treeClasses.HIDDEN, isModelEmpty)
  // Update the tree view.
  let selectedNode = null
  this.treeModel.traverseDepthFirst(viewInfo => {
    if (!state.rowEl) {
      // This is the first row.
      const firstRowEl = this.createRowForViewInfo(viewInfo, state)
      state.rowEl = firstRowEl
      state.plyToIndent[0] = 0
    }
    state.plyToIndent.splice(viewInfo.lastMovePly + 1)
    let newRow = false
    if (state.plyToIndent[viewInfo.lastMovePly]) {
      state.indent = state.plyToIndent[viewInfo.lastMovePly]
      state.rowEl = this.createRowForViewInfo(viewInfo, state)
      newRow = true
    }
    const newNode = this.appendNodeEl(state, viewInfo, newRow)
    if (viewInfo.isSelected) {
      selectedNode = newNode
    }
    if (viewInfo.numChildren > 1) {
      this.createSegmentForViewInfo(viewInfo, state)
      state.plyToIndent[viewInfo.lastMovePly + 1] = state.indent + 1
    }
  }, this.annotator)
  try {
    const color = this.treeModel.repertoireColor
    this.board.setStateFromChess(this.treeModel.getChessForState())
    this.board.setOrientationForColor(color)
  } catch (e) {
    showStatus('Imported the moves, but the board could not be updated.')
  }
  // Scroll the tree view so that the selected node is in view.
  if (selectedNode) {
    const scrollTop = this.treeViewOuterElement.offsetTop +
        this.treeViewOuterElement.scrollTop
    const scrollBottom = scrollTop + this.treeViewOuterElement.offsetHeight
    if (selectedNode.offsetTop < scrollTop ||
                selectedNode.offsetTop > scrollBottom) {
      this.treeViewOuterElement.scrollTop = selectedNode.offsetTop -
                    this.treeViewOuterElement.offsetTop
    }
  }
}
TreeView.prototype.createSegmentForViewInfo = function (viewInfo, state) {
  const segmentEl = document.createElement('div')
  segmentEl.classList.add(treeClasses.SEGMENT)
  state.pgnToSegment.set(viewInfo.pgn, segmentEl)
  const segmentParent = state.rowEl
    ? state.rowEl
    : this.treeViewInnerElement
  segmentParent.appendChild(segmentEl)
}
TreeView.prototype.createRowForViewInfo = function (viewInfo, state) {
  const rowEl = document.createElement('div')
  rowEl.classList.add(treeClasses.ROW)
  let rowParent = this.treeViewInnerElement
  // This needs to check for null explicitly since parentPgn can be the empty string.
  if (viewInfo.parentPgn !== null) {
    const parentSegment = state.pgnToSegment.get(viewInfo.parentPgn)
    if (parentSegment) {
      rowParent = parentSegment
    }
  }
  rowParent.appendChild(rowEl)
  return rowEl
}
TreeView.prototype.appendNodeEl = function (state, viewInfo, newRow) {
  const cell = document.createElement('div')
  let label = '(start)'
  if (viewInfo.lastMoveString) {
    label = viewInfo.lastMoveColor === 'w'
      ? viewInfo.lastMoveVerboseString
      : (newRow
          ? viewInfo.lastMoveVerboseString
          : viewInfo.lastMoveString)
  }
  cell.innerText = label
  cell.classList.add(treeClasses.NODE)
  cell.onclick = this.treeNodeHandler.onClick.bind(this.treeNodeHandler, viewInfo.pgn)
  cell.classList.toggle(treeClasses.SELECTED_NODE, viewInfo.isSelected)
  if (viewInfo.annotation) {
    this.annotationRenderer.renderAnnotation(viewInfo.annotation, cell)
  }
  assert(state.rowEl).appendChild(cell)
  return cell
}

function TraversalState () {
  this.indent = 0
  this.plyToIndent = []
  this.pgnToSegment = new Map()
  this.rowEl = null
}

const DisplayType = {
  WARNING: 0,
  INFORMATIONAL: 1
}

const annotationClasses = {
  TRANSPOSITION_NODE: 'transpositionNode',
  WARNING_NODE: 'warningNode'
}
function DefaultAnnotationRenderer () {}
DefaultAnnotationRenderer.prototype.renderAnnotation = function (annotation, cell) {
  if (!annotation) {
    return
  }
  if (annotation.displayType === DisplayType.WARNING) {
    cell.classList.add(annotationClasses.WARNING_NODE)
  } else if (annotation.displayType === DisplayType.INFORMATIONAL) {
    cell.classList.add(annotationClasses.TRANSPOSITION_NODE)
  }
  const text = [annotation.title, annotation.content]
    .filter(Boolean)
    .join(': ')
    .replace(/<[^>]+>/g, '')
  cell.title = text
}

function DefaultAnnotator () {}
DefaultAnnotator.prototype.annotate = function (node, repertoireColor, pgnToNode, fenToPgn) {
  const repetition = this.calculateRepetition(node, pgnToNode, fenToPgn)
  const transposition = this.calculateTransposition(node, pgnToNode, fenToPgn)
  const warning = this.calculateWarning(node, repertoireColor, repetition, transposition)
  return warning || repetition || transposition || null
}
DefaultAnnotator.prototype.calculateRepetition = function (node, pgnToNode, fenToPgn) {
  const normalizedFen = normalizeFen(node.fen, node.numLegalMoves)
  if (!fenToPgn[normalizedFen] ||
            fenToPgn[normalizedFen].length < 2 ||
            fenToPgn[normalizedFen][0] === node.pgn) {
    // This is a unique position or the first occurrence of it.
    return null
  }
  for (let i = 0; i < fenToPgn[normalizedFen].length; i++) {
    const repetitionPgn = fenToPgn[normalizedFen][i]
    const repetitionNode = pgnToNode[repetitionPgn]
    if (node.pgn !== repetitionPgn &&
                node.pgn.startsWith(repetitionPgn) &&
                repetitionNode) {
      // This is a repetition.
      const repetitionContent = '<b>' + node.lastMoveVerboseString +
                    '</b> is a repetition of the position after <b>' +
                    repetitionNode.lastMoveVerboseString +
                    '</b>.'
      return {
        title: 'Repetition',
        content: repetitionContent,
        displayType: DisplayType.INFORMATIONAL
      }
    }
  }
  return null
}
DefaultAnnotator.prototype.calculateTransposition = function (node, pgnToNode, fenToPgn) {
  const normalizedFen = normalizeFen(node.fen, node.numLegalMoves)
  const pgnsForFen = fenToPgn[normalizedFen]
  if (!pgnsForFen || pgnsForFen.length < 2) {
    // This is a unique position.
    return null
  }
  const nodesWithChildrenForFen = pgnsForFen
    .map(p => pgnToNode[p])
    .filter(n => n.children.length)
  let transpositionPgn
  if (!nodesWithChildrenForFen.length) {
    // If none of the nodes for the repeated position have children, then
    // arbitrarily choose the first occurrence as not being a transposition.
    transpositionPgn = pgnsForFen[0]
  } else {
    // Otherwise, choose the first occurrence of the repeated position with
    // children to not be a transposition.
    transpositionPgn = nodesWithChildrenForFen[0].pgn
  }
  if (node.pgn === transpositionPgn) {
    // Other occurrences of this position transpose to this one.
    return null
  }
  const transpositionContent = '<b>' + node.lastMoveVerboseString +
            '</b> transposes to: <p><b>' +
            (transpositionPgn || '(start)') +
            '</b>.'
  return {
    title: 'Transposition',
    content: transpositionContent,
    displayType: DisplayType.INFORMATIONAL
  }
}
DefaultAnnotator.prototype.calculateWarning = function (node, repertoireColor, repetition, transposition) {
  const warnings = []
  const numChildren = node.children.length
  const displayColor = repertoireColor === 'w' ? 'White' : 'Black'
  if (numChildren > 0) {
    if (repetition) {
      warnings.push(repetition.content +
                    '<p>Lines containing repetitions must end on the first repeated ' +
                    'position.<p>To fix, delete all moves after <b>' +
                    node.lastMoveVerboseString +
                    '</b>.')
    } else if (transposition) {
      warnings.push(transposition.content +
                    '<p>Continuations from this position should be added to that ' +
                    'line instead.<p>To fix, delete all moves after <b>' +
                    node.lastMoveVerboseString +
                    '</b>.')
    }
  }
  if (node.colorToMove === repertoireColor) {
    if (!transposition && !numChildren) {
      warnings.push(displayColor +
                    ' has no reply to <b>' +
                    node.lastMoveVerboseString +
                    '</b>.<p>To fix, add a move for ' +
                    displayColor +
                    ' after <b>' +
                    node.lastMoveVerboseString +
                    '</b> or delete this move.')
    }
    if (!transposition && numChildren > 1) {
      warnings.push('There are multiple moves for ' +
                    displayColor +
                    ' after <b>' +
                    node.lastMoveVerboseString +
                    '</b> (' +
                    (node.children.length > 2 ? 'e.g. ' : '') +
                    '<b>' +
                    node.children[0].lastMoveVerboseString +
                    '</b> and <b>' +
                    node.children[1].lastMoveVerboseString +
                    '</b>).<p>To fix, choose at most one move for ' +
                    displayColor +
                    ' from this position and delete all other moves.')
    }
  }
  return warnings.length
    ? {
        title: 'Warnings',
        content: warnings[0],
        displayType: DisplayType.WARNING
      }
    : null
}

function parsePgn (input) {
  let index = 0
  const games = []

  function location () {
    const lines = input.slice(0, index).split('\n')
    return { start: { line: lines.length, column: lines[lines.length - 1].length + 1 } }
  }

  function fail (message) {
    const error = new Error(message)
    error.location = location()
    throw error
  }

  function skipDecorations () {
    for (;;) {
      while (index < input.length && /\s/.test(input[index])) index++
      if (input[index] === '{') {
        const end = input.indexOf('}', index + 1)
        if (end < 0) fail('Unclosed comment.')
        index = end + 1
      } else if (input[index] === ';') {
        const end = input.indexOf('\n', index + 1)
        index = end < 0 ? input.length : end + 1
      } else if (input[index] === '[') {
        const end = input.indexOf(']', index + 1)
        if (end < 0) fail('Unclosed header.')
        index = end + 1
      } else if (input[index] === '$') {
        index++
        while (/[0-9]/.test(input[index] || '')) index++
      } else if (input[index] === '!' || input[index] === '?') {
        while (input[index] === '!' || input[index] === '?') index++
      } else {
        return
      }
    }
  }

  function readResult () {
    const result = input.slice(index).match(/^(1-0|0-1|1\/2-1\/2|\*)/)
    if (!result) return false
    index += result[0].length
    return true
  }

  function readMoveNumber () {
    const number = input.slice(index).match(/^\d+\.(\.\.)?/)
    if (!number) return false
    index += number[0].length
    return true
  }

  function readMove () {
    const move = input.slice(index).match(/^(?:O-O-O|0-0-0|O-O|0-0|[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?)[+#]?/)
    if (!move) return null
    index += move[0].length
    return move[0].replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O')
  }

  function readVariation () {
    const moves = []
    skipDecorations()
    while (index < input.length && input[index] !== ')') {
      skipDecorations()
      if (index >= input.length || input[index] === ')') break
      if (input[index] === '(') {
        if (!moves.length) fail('A variation needs a move before it.')
        index++
        const variation = readVariation()
        if (input[index] !== ')') fail('Unclosed variation.')
        index++
        const previous = moves[moves.length - 1]
        previous.ravs = previous.ravs || []
        previous.ravs.push(variation)
        continue
      }
      if (readResult()) break
      if (input[index] === '[') break
      if (readMoveNumber()) continue
      const move = readMove()
      if (!move) fail('Expected a chess move.')
      moves.push({ move })
    }
    return { moves }
  }

  while (index < input.length) {
    skipDecorations()
    if (index >= input.length) break
    const game = readVariation()
    if (game.moves.length) games.push(game)
    else if (index < input.length) fail('Expected a chess move.')
  }
  if (!games.length) fail('No moves found.')
  return games
}

function getUtcDate (now) {
  const year = zeroFill(now.getUTCFullYear(), 4)
  const month = zeroFill(now.getUTCMonth() + 1, 2)
  const day = zeroFill(now.getUTCDate(), 2)
  return `${year}.${month}.${day}`
}

function getUtcTime (now) {
  const hour = zeroFill(now.getUTCHours(), 2)
  const minutes = zeroFill(now.getUTCMinutes(), 2)
  const seconds = zeroFill(now.getUTCSeconds(), 2)
  return `${hour}:${minutes}:${seconds}`
}

function zeroFill (n, numDigits) {
  let ans = n.toString()
  for (let i = 0; i < numDigits - ans.length; i++) {
    ans = '0' + ans
  }
  return ans
}

const ExampleRepertoires = {
  KINGS_GAMBIT: "{\"name\":\"King's Gambit for Black\",\"color\":\"b\",\"root\":{\"pgn\":\"\",\"fen\":\"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq20\",\"nlm\":20,\"ctm\":\"w\",\"lmf\":\"\",\"lmt\":\"\",\"lms\":\"(start)\",\"c\":[{\"pgn\":\"1. e4\",\"fen\":\"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1\",\"nlm\":20,\"ctm\":\"b\",\"lmf\":\"e2\",\"lmt\":\"e4\",\"lms\":\"e4\",\"c\":[{\"pgn\":\"1. e4 e5\",\"fen\":\"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2\",\"nlm\":29,\"ctm\":\"w\",\"lmf\":\"e7\",\"lmt\":\"e5\",\"lms\":\"e5\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4\",\"fen\":\"rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq f3 0 2\",\"nlm\":30,\"ctm\":\"b\",\"lmf\":\"f2\",\"lmt\":\"f4\",\"lms\":\"f4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4\",\"fen\":\"rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPP2PP/RNBQKBNR w KQkq - 0 3\",\"nlm\":29,\"ctm\":\"w\",\"lmf\":\"e5\",\"lmt\":\"f4\",\"lms\":\"exf4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3\",\"fen\":\"rnbqkbnr/pppp1ppp/8/8/4Pp2/5N2/PPPP2PP/RNBQKB1R b KQkq - 1 3\",\"nlm\":29,\"ctm\":\"b\",\"lmf\":\"g1\",\"lmt\":\"f3\",\"lms\":\"Nf3\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5\",\"fen\":\"rnbqkbnr/pppp1p1p/8/6p1/4Pp2/5N2/PPPP2PP/RNBQKB1R w KQkq g6 0 4\",\"nlm\":29,\"ctm\":\"w\",\"lmf\":\"g7\",\"lmt\":\"g5\",\"lms\":\"g5\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4\",\"fen\":\"rnbqkbnr/pppp1p1p/8/6p1/2B1Pp2/5N2/PPPP2PP/RNBQK2R b KQkq - 1 4\",\"nlm\":28,\"ctm\":\"b\",\"lmf\":\"f1\",\"lmt\":\"c4\",\"lms\":\"Bc4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7\",\"fen\":\"rnbqk1nr/pppp1pbp/8/6p1/2B1Pp2/5N2/PPPP2PP/RNBQK2R w KQkq - 2 5\",\"nlm\":35,\"ctm\":\"w\",\"lmf\":\"f8\",\"lmt\":\"g7\",\"lms\":\"Bg7\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O\",\"fen\":\"rnbqk1nr/pppp1pbp/8/6p1/2B1Pp2/5N2/PPPP2PP/RNBQ1RK1 b kq - 3 5\",\"nlm\":29,\"ctm\":\"b\",\"lmf\":\"e1\",\"lmt\":\"g1\",\"lms\":\"O-O\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6\",\"fen\":\"rnbqk1nr/ppp2pbp/3p4/6p1/2B1Pp2/5N2/PPPP2PP/RNBQ1RK1 w kq - 0 6\",\"nlm\":33,\"ctm\":\"w\",\"lmf\":\"d7\",\"lmt\":\"d6\",\"lms\":\"d6\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6 6. d4\",\"fen\":\"rnbqk1nr/ppp2pbp/3p4/6p1/2BPPp2/5N2/PPP3PP/RNBQ1RK1 b kq d3 0 6\",\"nlm\":34,\"ctm\":\"b\",\"lmf\":\"d2\",\"lmt\":\"d4\",\"lms\":\"d4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6 6. d4 h6\",\"fen\":\"rnbqk1nr/ppp2pb1/3p3p/6p1/2BPPp2/5N2/PPP3PP/RNBQ1RK1 w kq - 0 7\",\"nlm\":38,\"ctm\":\"w\",\"lmf\":\"h7\",\"lmt\":\"h6\",\"lms\":\"h6\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6 6. d4 h6 7. Nc3\",\"fen\":\"rnbqk1nr/ppp2pb1/3p3p/6p1/2BPPp2/2N2N2/PPP3PP/R1BQ1RK1 b kq - 1 7\",\"nlm\":32,\"ctm\":\"b\",\"lmf\":\"b1\",\"lmt\":\"c3\",\"lms\":\"Nc3\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6 6. d4 h6 7. Nc3 Nc6\",\"fen\":\"r1bqk1nr/ppp2pb1/2np3p/6p1/2BPPp2/2N2N2/PPP3PP/R1BQ1RK1 w kq - 2 8\",\"nlm\":40,\"ctm\":\"w\",\"lmf\":\"b8\",\"lmt\":\"c6\",\"lms\":\"Nc6\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6 6. d4 h6 7. Nc3 Nc6 8. Bb5\",\"fen\":\"r1bqk1nr/ppp2pb1/2np3p/1B4p1/3PPp2/2N2N2/PPP3PP/R1BQ1RK1 b kq - 3 8\",\"nlm\":27,\"ctm\":\"b\",\"lmf\":\"c4\",\"lmt\":\"b5\",\"lms\":\"Bb5\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6 6. d4 h6 7. Nc3 Nc6 8. Bb5 Ne7\",\"fen\":\"r1bqk2r/ppp1npb1/2np3p/1B4p1/3PPp2/2N2N2/PPP3PP/R1BQ1RK1 w kq - 4 9\",\"nlm\":37,\"ctm\":\"w\",\"lmf\":\"g8\",\"lmt\":\"e7\",\"lms\":\"Ne7\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6 6. d4 h6 7. Nc3 Nc6 8. Bb5 Ne7 9. Nd5\",\"fen\":\"r1bqk2r/ppp1npb1/2np3p/1B1N2p1/3PPp2/5N2/PPP3PP/R1BQ1RK1 b kq - 5 9\",\"nlm\":28,\"ctm\":\"b\",\"lmf\":\"c3\",\"lmt\":\"d5\",\"lms\":\"Nd5\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6 6. d4 h6 7. Nc3 Nc6 8. Bb5 Ne7 9. Nd5 O-O\",\"fen\":\"r1bq1rk1/ppp1npb1/2np3p/1B1N2p1/3PPp2/5N2/PPP3PP/R1BQ1RK1 w - - 6 10\",\"nlm\":42,\"ctm\":\"w\",\"lmf\":\"e8\",\"lmt\":\"g8\",\"lms\":\"O-O\",\"c\":[]}]}]}]}]}]},{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6 6. d4 h6 7. c3\",\"fen\":\"rnbqk1nr/ppp2pb1/3p3p/6p1/2BPPp2/2P2N2/PP4PP/RNBQ1RK1 b kq - 0 7\",\"nlm\":32,\"ctm\":\"b\",\"lmf\":\"c2\",\"lmt\":\"c3\",\"lms\":\"c3\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6 6. d4 h6 7. c3 Nc6\",\"fen\":\"r1bqk1nr/ppp2pb1/2np3p/6p1/2BPPp2/2P2N2/PP4PP/RNBQ1RK1 w kq - 1 8\",\"nlm\":39,\"ctm\":\"w\",\"lmf\":\"b8\",\"lmt\":\"c6\",\"lms\":\"Nc6\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6 6. d4 h6 7. c3 Nc6 8. Qb3\",\"fen\":\"r1bqk1nr/ppp2pb1/2np3p/6p1/2BPPp2/1QP2N2/PP4PP/RNB2RK1 b kq - 2 8\",\"nlm\":34,\"ctm\":\"b\",\"lmf\":\"d1\",\"lmt\":\"b3\",\"lms\":\"Qb3\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. O-O d6 6. d4 h6 7. c3 Nc6 8. Qb3 Qd7\",\"fen\":\"r1b1k1nr/pppq1pb1/2np3p/6p1/2BPPp2/1QP2N2/PP4PP/RNB2RK1 w kq - 3 9\",\"nlm\":38,\"ctm\":\"w\",\"lmf\":\"d8\",\"lmt\":\"d7\",\"lms\":\"Qd7\",\"c\":[]}]}]}]}]}]}]}]},{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. d4\",\"fen\":\"rnbqk1nr/pppp1pbp/8/6p1/2BPPp2/5N2/PPP3PP/RNBQK2R b KQkq d3 0 5\",\"nlm\":27,\"ctm\":\"b\",\"lmf\":\"d2\",\"lmt\":\"d4\",\"lms\":\"d4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. d4 d6\",\"fen\":\"rnbqk1nr/ppp2pbp/3p4/6p1/2BPPp2/5N2/PPP3PP/RNBQK2R w KQkq - 0 6\",\"nlm\":41,\"ctm\":\"w\",\"lmf\":\"d7\",\"lmt\":\"d6\",\"lms\":\"d6\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 Bg7 5. d4 d6 6. O-O\",\"fen\":\"rnbqk1nr/ppp2pbp/3p4/6p1/2BPPp2/5N2/PPP3PP/RNBQ1RK1 b kq - 1 6\",\"nlm\":34,\"ctm\":\"b\",\"lmf\":\"e1\",\"lmt\":\"g1\",\"lms\":\"O-O\",\"c\":[]}]}]}]}]},{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4\",\"fen\":\"rnbqkbnr/pppp1p1p/8/6p1/4Pp1P/5N2/PPPP2P1/RNBQKB1R b KQkq h3 0 4\",\"nlm\":29,\"ctm\":\"b\",\"lmf\":\"h2\",\"lmt\":\"h4\",\"lms\":\"h4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4\",\"fen\":\"rnbqkbnr/pppp1p1p/8/8/4PppP/5N2/PPPP2P1/RNBQKB1R w KQkq - 0 5\",\"nlm\":29,\"ctm\":\"w\",\"lmf\":\"g5\",\"lmt\":\"g4\",\"lms\":\"g4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5\",\"fen\":\"rnbqkbnr/pppp1p1p/8/4N3/4PppP/8/PPPP2P1/RNBQKB1R b KQkq - 1 5\",\"nlm\":31,\"ctm\":\"b\",\"lmf\":\"f3\",\"lmt\":\"e5\",\"lms\":\"Ne5\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6\",\"fen\":\"rnbqkb1r/pppp1p1p/5n2/4N3/4PppP/8/PPPP2P1/RNBQKB1R w KQkq - 2 6\",\"nlm\":33,\"ctm\":\"w\",\"lmf\":\"g8\",\"lmt\":\"f6\",\"lms\":\"Nf6\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Bc4\",\"fen\":\"rnbqkb1r/pppp1p1p/5n2/4N3/2B1PppP/8/PPPP2P1/RNBQK2R b KQkq - 3 6\",\"nlm\":28,\"ctm\":\"b\",\"lmf\":\"f1\",\"lmt\":\"c4\",\"lms\":\"Bc4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Bc4 d5\",\"fen\":\"rnbqkb1r/ppp2p1p/5n2/3pN3/2B1PppP/8/PPPP2P1/RNBQK2R w KQkq d6 0 7\",\"nlm\":37,\"ctm\":\"w\",\"lmf\":\"d7\",\"lmt\":\"d5\",\"lms\":\"d5\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Bc4 d5 7. exd5\",\"fen\":\"rnbqkb1r/ppp2p1p/5n2/3PN3/2B2ppP/8/PPPP2P1/RNBQK2R b KQkq - 0 7\",\"nlm\":34,\"ctm\":\"b\",\"lmf\":\"e4\",\"lmt\":\"d5\",\"lms\":\"exd5\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Bc4 d5 7. exd5 Bd6\",\"fen\":\"rnbqk2r/ppp2p1p/3b1n2/3PN3/2B2ppP/8/PPPP2P1/RNBQK2R w KQkq - 1 8\",\"nlm\":35,\"ctm\":\"w\",\"lmf\":\"f8\",\"lmt\":\"d6\",\"lms\":\"Bd6\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Bc4 d5 7. exd5 Bd6 8. d4\",\"fen\":\"rnbqk2r/ppp2p1p/3b1n2/3PN3/2BP1ppP/8/PPP3P1/RNBQK2R b KQkq d3 0 8\",\"nlm\":34,\"ctm\":\"b\",\"lmf\":\"d2\",\"lmt\":\"d4\",\"lms\":\"d4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Bc4 d5 7. exd5 Bd6 8. d4 O-O\",\"fen\":\"rnbq1rk1/ppp2p1p/3b1n2/3PN3/2BP1ppP/8/PPP3P1/RNBQK2R w KQ - 1 9\",\"nlm\":40,\"ctm\":\"w\",\"lmf\":\"e8\",\"lmt\":\"g8\",\"lms\":\"O-O\",\"c\":[]}]}]}]}]}]},{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4\",\"fen\":\"rnbqkb1r/pppp1p1p/5n2/8/4PpNP/8/PPPP2P1/RNBQKB1R b KQkq - 0 6\",\"nlm\":28,\"ctm\":\"b\",\"lmf\":\"e5\",\"lmt\":\"g4\",\"lms\":\"Nxg4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4\",\"fen\":\"rnbqkb1r/pppp1p1p/8/8/4npNP/8/PPPP2P1/RNBQKB1R w KQkq - 0 7\",\"nlm\":29,\"ctm\":\"w\",\"lmf\":\"f6\",\"lmt\":\"e4\",\"lms\":\"Nxe4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3\",\"fen\":\"rnbqkb1r/pppp1p1p/8/8/4npNP/3P4/PPP3P1/RNBQKB1R b KQkq - 0 7\",\"nlm\":36,\"ctm\":\"b\",\"lmf\":\"d2\",\"lmt\":\"d3\",\"lms\":\"d3\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3\",\"fen\":\"rnbqkb1r/pppp1p1p/8/8/5pNP/3P2n1/PPP3P1/RNBQKB1R w KQkq - 1 8\",\"nlm\":29,\"ctm\":\"w\",\"lmf\":\"e4\",\"lmt\":\"g3\",\"lms\":\"Ng3\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3 8. Bxf4\",\"fen\":\"rnbqkb1r/pppp1p1p/8/8/5BNP/3P2n1/PPP3P1/RN1QKB1R b KQkq - 0 8\",\"nlm\":33,\"ctm\":\"b\",\"lmf\":\"c1\",\"lmt\":\"f4\",\"lms\":\"Bxf4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3 8. Bxf4 Qe7+\",\"fen\":\"rnb1kb1r/ppppqp1p/8/8/5BNP/3P2n1/PPP3P1/RN1QKB1R w KQkq - 1 9\",\"nlm\":8,\"ctm\":\"w\",\"lmf\":\"d8\",\"lmt\":\"e7\",\"lms\":\"Qe7+\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3 8. Bxf4 Qe7+ 9. Be2\",\"fen\":\"rnb1kb1r/ppppqp1p/8/8/5BNP/3P2n1/PPP1B1P1/RN1QK2R b KQkq - 2 9\",\"nlm\":37,\"ctm\":\"b\",\"lmf\":\"f1\",\"lmt\":\"e2\",\"lms\":\"Be2\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3 8. Bxf4 Qe7+ 9. Be2 Rg8\",\"fen\":\"rnb1kbr1/ppppqp1p/8/8/5BNP/3P2n1/PPP1B1P1/RN1QK2R w KQq - 3 10\",\"nlm\":34,\"ctm\":\"w\",\"lmf\":\"h8\",\"lmt\":\"g8\",\"lms\":\"Rg8\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3 8. Bxf4 Qe7+ 9. Be2 Rg8 10. Bxg3\",\"fen\":\"rnb1kbr1/ppppqp1p/8/8/6NP/3P2B1/PPP1B1P1/RN1QK2R b KQq - 0 10\",\"nlm\":35,\"ctm\":\"b\",\"lmf\":\"f4\",\"lmt\":\"g3\",\"lms\":\"Bxg3\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3 8. Bxf4 Qe7+ 9. Be2 Rg8 10. Bxg3 Rxg4\",\"fen\":\"rnb1kb2/ppppqp1p/8/8/6rP/3P2B1/PPP1B1P1/RN1QK2R w KQq - 0 11\",\"nlm\":27,\"ctm\":\"w\",\"lmf\":\"g8\",\"lmt\":\"g4\",\"lms\":\"Rxg4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3 8. Bxf4 Qe7+ 9. Be2 Rg8 10. Bxg3 Rxg4 11. Bf2\",\"fen\":\"rnb1kb2/ppppqp1p/8/8/6rP/3P4/PPP1BBP1/RN1QK2R b KQq - 1 11\",\"nlm\":43,\"ctm\":\"b\",\"lmf\":\"g3\",\"lmt\":\"f2\",\"lms\":\"Bf2\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3 8. Bxf4 Qe7+ 9. Be2 Rg8 10. Bxg3 Rxg4 11. Bf2 Rxg2\",\"fen\":\"rnb1kb2/ppppqp1p/8/8/7P/3P4/PPP1BBr1/RN1QK2R w KQq - 0 12\",\"nlm\":26,\"ctm\":\"w\",\"lmf\":\"g4\",\"lmt\":\"g2\",\"lms\":\"Rxg2\",\"c\":[]}]}]}]}]}]},{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3 8. Bxf4 Qe7+ 9. Kd2\",\"fen\":\"rnb1kb1r/ppppqp1p/8/8/5BNP/3P2n1/PPPK2P1/RN1Q1B1R b kq - 2 9\",\"nlm\":38,\"ctm\":\"b\",\"lmf\":\"e1\",\"lmt\":\"d2\",\"lms\":\"Kd2\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3 8. Bxf4 Qe7+ 9. Kd2 Qb4+\",\"fen\":\"rnb1kb1r/pppp1p1p/8/8/1q3BNP/3P2n1/PPPK2P1/RN1Q1B1R w kq - 3 10\",\"nlm\":4,\"ctm\":\"w\",\"lmf\":\"e7\",\"lmt\":\"b4\",\"lms\":\"Qb4+\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3 8. Bxf4 Qe7+ 9. Kd2 Qb4+ 10. Nc3\",\"fen\":\"rnb1kb1r/pppp1p1p/8/8/1q3BNP/2NP2n1/PPPK2P1/R2Q1B1R b kq - 4 10\",\"nlm\":43,\"ctm\":\"b\",\"lmf\":\"b1\",\"lmt\":\"c3\",\"lms\":\"Nc3\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Nxg4 Nxe4 7. d3 Ng3 8. Bxf4 Qe7+ 9. Kd2 Qb4+ 10. Nc3 Qxf4+\",\"fen\":\"rnb1kb1r/pppp1p1p/8/8/5qNP/2NP2n1/PPPK2P1/R2Q1B1R w kq - 0 11\",\"nlm\":2,\"ctm\":\"w\",\"lmf\":\"b4\",\"lmt\":\"f4\",\"lms\":\"Qxf4+\",\"c\":[]}]}]}]}]}]}]}]}]}]}]}]},{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ng5\",\"fen\":\"rnbqkbnr/pppp1p1p/8/6N1/4PppP/8/PPPP2P1/RNBQKB1R b KQkq - 1 5\",\"nlm\":30,\"ctm\":\"b\",\"lmf\":\"f3\",\"lmt\":\"g5\",\"lms\":\"Ng5\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ng5 h6\",\"fen\":\"rnbqkbnr/pppp1p2/7p/6N1/4PppP/8/PPPP2P1/RNBQKB1R w KQkq - 0 6\",\"nlm\":31,\"ctm\":\"w\",\"lmf\":\"h7\",\"lmt\":\"h6\",\"lms\":\"h6\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ng5 h6 6. Nxf7\",\"fen\":\"rnbqkbnr/pppp1N2/7p/8/4PppP/8/PPPP2P1/RNBQKB1R b KQkq - 0 6\",\"nlm\":28,\"ctm\":\"b\",\"lmf\":\"g5\",\"lmt\":\"f7\",\"lms\":\"Nxf7\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ng5 h6 6. Nxf7 Kxf7\",\"fen\":\"rnbq1bnr/pppp1k2/7p/8/4PppP/8/PPPP2P1/RNBQKB1R w KQ - 0 7\",\"nlm\":26,\"ctm\":\"w\",\"lmf\":\"e8\",\"lmt\":\"f7\",\"lms\":\"Kxf7\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ng5 h6 6. Nxf7 Kxf7 7. Qxg4\",\"fen\":\"rnbq1bnr/pppp1k2/7p/8/4PpQP/8/PPPP2P1/RNB1KB1R b KQ - 0 7\",\"nlm\":29,\"ctm\":\"b\",\"lmf\":\"d1\",\"lmt\":\"g4\",\"lms\":\"Qxg4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ng5 h6 6. Nxf7 Kxf7 7. Qxg4 Nf6\",\"fen\":\"rnbq1b1r/pppp1k2/5n1p/8/4PpQP/8/PPPP2P1/RNB1KB1R w KQ - 1 8\",\"nlm\":38,\"ctm\":\"w\",\"lmf\":\"g8\",\"lmt\":\"f6\",\"lms\":\"Nf6\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ng5 h6 6. Nxf7 Kxf7 7. Qxg4 Nf6 8. Qxf4\",\"fen\":\"rnbq1b1r/pppp1k2/5n1p/8/4PQ1P/8/PPPP2P1/RNB1KB1R b KQ - 0 8\",\"nlm\":27,\"ctm\":\"b\",\"lmf\":\"g4\",\"lmt\":\"f4\",\"lms\":\"Qxf4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ng5 h6 6. Nxf7 Kxf7 7. Qxg4 Nf6 8. Qxf4 Bd6\",\"fen\":\"rnbq3r/pppp1k2/3b1n1p/8/4PQ1P/8/PPPP2P1/RNB1KB1R w KQ - 1 9\",\"nlm\":37,\"ctm\":\"w\",\"lmf\":\"f8\",\"lmt\":\"d6\",\"lms\":\"Bd6\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ng5 h6 6. Nxf7 Kxf7 7. Qxg4 Nf6 8. Qxf4 Bd6 9. Bc4+\",\"fen\":\"rnbq3r/pppp1k2/3b1n1p/8/2B1PQ1P/8/PPPP2P1/RNB1K2R b KQ - 2 9\",\"nlm\":5,\"ctm\":\"b\",\"lmf\":\"f1\",\"lmt\":\"c4\",\"lms\":\"Bc4+\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ng5 h6 6. Nxf7 Kxf7 7. Qxg4 Nf6 8. Qxf4 Bd6 9. Bc4+ Kg7\",\"fen\":\"rnbq3r/pppp2k1/3b1n1p/8/2B1PQ1P/8/PPPP2P1/RNB1K2R w KQ - 3 10\",\"nlm\":45,\"ctm\":\"w\",\"lmf\":\"f7\",\"lmt\":\"g7\",\"lms\":\"Kg7\",\"c\":[]}]}]}]}]}]}]}]}]}]}]}]}]}]},{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Bc4\",\"fen\":\"rnbqkbnr/pppp1ppp/8/8/2B1Pp2/8/PPPP2PP/RNBQK1NR b KQkq - 1 3\",\"nlm\":30,\"ctm\":\"b\",\"lmf\":\"f1\",\"lmt\":\"c4\",\"lms\":\"Bc4\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Bc4 g5\",\"fen\":\"rnbqkbnr/pppp1p1p/8/6p1/2B1Pp2/8/PPPP2PP/RNBQK1NR w KQkq g6 0 4\",\"nlm\":33,\"ctm\":\"w\",\"lmf\":\"g7\",\"lmt\":\"g5\",\"lms\":\"g5\",\"c\":[{\"pgn\":\"1. e4 e5 2. f4 exf4 3. Bc4 g5 4. Nf3\",\"fen\":\"rnbqkbnr/pppp1p1p/8/6p1/2B1Pp2/5N2/PPPP2PP/RNBQK2R b KQkq - 1 4\",\"nlm\":28,\"ctm\":\"b\",\"lmf\":\"g1\",\"lmt\":\"f3\",\"lms\":\"Nf3\",\"c\":[]}]}]}]}]}]}]}]}}"
}

function TreeModelPopulator (mainLineVariations, status) {
  this.status = status
  const now = new Date()
  this.treeModel = new TreeModel()
  this.treeModel.repertoireName = `PGN imported on ${getUtcDate(now)} ${getUtcTime(now)}`
  this.pendingOperations = []
  mainLineVariations.forEach(v => {
    if (v.moves.length) {
      this.pendingOperations.push({
        startPgn: '',
        variation: v,
        moveIndex: 0
      })
    }
  })
  this.populatedMoves = 0
  this.totalMoves = mainLineVariations
    .map(v => TreeModelPopulator.countTotalMoves(v))
    .reduce((x, y) => x + y, 0)
}
TreeModelPopulator.prototype.countPopulatedMoves = function () {
  return this.populatedMoves
}
TreeModelPopulator.prototype.countTotalMoves = function () {
  return this.totalMoves
}
TreeModelPopulator.prototype.doIncrementalWork = function () {
  const operation = this.pendingOperations.shift()
  if (!operation) {
    throw new Error('No more work!')
  }
  const node = operation.variation.moves[operation.moveIndex]
  const result = this.treeModel.addMove(operation.startPgn, node.move)
  if (!result.success) {
    const startPgnString = operation.startPgn || '(start)'
    this.handleFailureReason(assert(result.failureReason), startPgnString, node.move)
    return
  }
  this.populatedMoves++
  const childPgn = this.treeModel.getSelectedViewInfo(NullAnnotator.INSTANCE).pgn
  if (operation.moveIndex < operation.variation.moves.length - 1) {
    this.pendingOperations.push({
      startPgn: childPgn,
      variation: operation.variation,
      moveIndex: operation.moveIndex + 1
    })
  }
  if (node.ravs) {
    for (let i = 0; i < node.ravs.length; i++) {
      this.pendingOperations.push({
        startPgn: operation.startPgn,
        variation: node.ravs[i],
        moveIndex: 0
      })
    }
  }
}
TreeModelPopulator.prototype.handleFailureReason = function (reason, startPgn, moveString) {
  switch (reason) {
    case AddMoveFailureReason.ILLEGAL_MOVE:
      this.status.addError(`${moveString} is not a legal move after ${startPgn}.`)
      break
    case AddMoveFailureReason.EXCEEDED_MAXIMUM_LINE_DEPTH:
      this.status.markLongLineTruncated()
      break
    case AddMoveFailureReason.EXCEEDED_MAXIMUM_NUM_NODES:
      this.status.markMaximumNumNodesReached()
      break
    default:
      throw new Error('Unknown failure reason.')
  }
}
TreeModelPopulator.prototype.isComplete = function () {
  return !this.pendingOperations.length
}
TreeModelPopulator.prototype.getPopulatedTreeModel = function () {
  if (!this.isComplete()) {
    throw new Error('Not complete yet!')
  }
  return this.treeModel
}
TreeModelPopulator.countTotalMoves = function (variation) {
  let totalMoves = variation.moves.length
  variation.moves.forEach(m => {
    if (m.ravs) {
      m.ravs.forEach(v => {
        totalMoves += TreeModelPopulator.countTotalMoves(v)
      })
    }
  })
  return totalMoves
}

function PgnParser () {}

PgnParser.parse = function (pgn) {
  if (!pgn) {
    throw new Error('PGN is empty.')
  }
  const result = parsePgn(pgn)
  if (!result || !result.length) {
    throw new Error('Unknown parsing error.')
  }
  return result
}

/**
 * A class which incrementally converts a PGN string into a Repertoire object.
 *
 * This conversion is done by constructing this Converter with the PGN string to
 * convert then repeatedly calling #doIncrementalWork until #isComplete returns
 * true. At that point, #getRepertoire will return the resulting repertoire.
 *
 * Since PGN parsing and conversion is expensive, this flow is intended to allow
 * the caller to only perform the conversion work when there is nothing else to
 * do (e.g. handling user input).
 */
function RepertoireIncrementalConverter (pgn, status) {
  this.repertoire = null

  this.pgn = pgn
  this.status = status
  this.parsedVariations = null
  this.populator = null
  status.label = 'Parsing PGN...'
}
RepertoireIncrementalConverter.prototype.doIncrementalWork = function () {
  if (this.repertoire) {
    throw new Error('Already done generating!')
  }
  if (!this.parsedVariations) {
    try {
      this.parsedVariations = PgnParser.parse(this.pgn)
    } catch (e) {
      let message = e.message
      if (e.location && e.location.start) {
        const l = e.location.start
        message = `At line ${l.line}, column ${l.column}: ${message}`
      }
      this.status.addError(message)
    }
    return
  }
  if (!this.populator) {
    this.populator = new TreeModelPopulator(this.parsedVariations, this.status)
    return
  }
  if (!this.populator.isComplete()) {
    this.populator.doIncrementalWork()
    this.status.label = `Imported ${this.populator.countPopulatedMoves()} / ` +
                `${this.populator.countTotalMoves()} moves...`
  }
  if (!this.populator.isComplete()) {
    return
  }
  this.status.label = 'Loading repertoire...'
  const treeModel = this.populator.getPopulatedTreeModel()
  this.repertoire = treeModel.serializeRepertoire()
}
RepertoireIncrementalConverter.prototype.isComplete = function () {
  return !!this.repertoire
}

function ConverterStatus () {
  this.label = ''
  this.errors = []

  this.truncatedLongLine = false
  this.reachedNodeLimit = false
}
ConverterStatus.prototype.markLongLineTruncated = function () {
  this.truncatedLongLine = true
}
ConverterStatus.prototype.hasTruncatedLongLine = function () {
  return this.truncatedLongLine
}
ConverterStatus.prototype.markMaximumNumNodesReached = function () {
  this.reachedNodeLimit = true
}
ConverterStatus.prototype.hasReachedNodeLimit = function () {
  return this.reachedNodeLimit
}
ConverterStatus.prototype.addError = function (error) {
  this.errors.push(error)
}

function PgnImporter () {}

PgnImporter.startPgnImport = function (pgn) {
  const status = new ConverterStatus()
  const converter = new RepertoireIncrementalConverter(pgn, status)
  const progress = new ImportProgress(status)
  setTimeout(() => this.doModeWork(progress, converter, status), 0)
  return progress
}
PgnImporter.doModeWork = function (progress, converter, status) {
  try {
    if (progress.isComplete()) return
    if (!converter.isComplete()) converter.doIncrementalWork()
    if (!converter.isComplete()) {
      setTimeout(() => PgnImporter.doModeWork(progress, converter, status), 0)
      return
    }
    PgnImporter.showNotices(status)
    progress.markFinished(converter.repertoire)
  } catch (e) {
    showStatus('Error importing PGN. ' + e.message)
    if (!progress.isComplete()) progress.cancel()
  }
}
PgnImporter.showNotices = function (status) {
  if (status.hasTruncatedLongLine()) {
    showStatus('Some lines were shortened. Opening lines can\'t be longer than ' +
                Config.MAXIMUM_LINE_DEPTH_IN_PLY + ' ply.')
  }
  if (status.hasReachedNodeLimit()) {
    showStatus('Some moves were not imported. Repertoires can\'t contain more than ' +
                Config.MAXIMUM_TREE_NODES_PER_REPERTOIRE + ' total moves.')
  }
}

function ImportProgress (status) {
  this.status = status
  this.resolveFn = () => { }
  this.rejectFn = () => { }
  this.promise = new Promise((resolve, reject) => {
    this.resolveFn = resolve
    this.rejectFn = reject
  })
  this.completed = false
}
ImportProgress.prototype.isComplete = function () {
  return this.completed
}
ImportProgress.prototype.cancel = function () {
  if (this.completed) {
    throw new Error('Import has already completed.')
  }
  this.rejectFn()
  this.completed = true
}
ImportProgress.prototype.markFinished = function (repertoire) {
  if (this.completed) {
    throw new Error('Import has already completed.')
  }
  this.resolveFn(repertoire)
  this.completed = true
}

function ImportDialog (textAreaEl, uploadEl, okButtonEl, statusEl) {
  this.textAreaEl = textAreaEl
  this.uploadEl = uploadEl
  this.okButtonEl = okButtonEl
  this.statusEl = statusEl
  this.importer = null
  this.importing = false
  textAreaEl.oninput = () => this.onTextAreaInput()
  uploadEl.onchange = () => this.onUpload()
  okButtonEl.onclick = () => this.onOkClick()
}
ImportDialog.prototype.setImporter = function (importer) {
  this.importer = importer
}
ImportDialog.prototype.isVisible = function () {
  return false
}
ImportDialog.prototype.show = function () { }
ImportDialog.prototype.hide = function () {
  this.textAreaEl.value = ''
  this.onTextAreaInput()
  this.hideProgress()
}
ImportDialog.prototype.showProgress = function (progressText) {
  if (!this.importing) return
  this.textAreaEl.disabled = true
  this.okButtonEl.disabled = true
  this.statusEl.textContent = progressText
}
ImportDialog.prototype.hideProgress = function () {
  this.importing = false
  this.textAreaEl.disabled = false
  this.okButtonEl.disabled = !this.textAreaEl.value
  this.statusEl.textContent = ''
}
ImportDialog.prototype.onKeyDown = function () { }
ImportDialog.prototype.onTextAreaInput = function () {
  this.okButtonEl.disabled = !this.textAreaEl.value
}
ImportDialog.prototype.onUpload = function () {
  const files = this.uploadEl.files
  if (!files || !files.length) {
    return
  }
  const fileToRead = files[0]
  const fileReader = new FileReader()
  fileReader.onload = (readEvent) => {
    this.textAreaEl.value = readEvent.target.result
    this.onTextAreaInput()
  }
  fileReader.onerror = () => {
    showStatus('Couldn\'t load PGN file. There was a problem loading \'' + fileToRead.name + '\'.')
  }
  fileReader.readAsText(fileToRead)
}
ImportDialog.prototype.onOkClick = function () {
  if (!this.importer) {
    throw new Error('No importer!')
  }
  if (!this.okButtonEl.disabled) {
    this.importer.startPgnImport(this.textAreaEl.value)
  }
}

function LineStudier (statisticRecorder, board) {
  this.statisticRecorder = statisticRecorder
  this.board = board
  this.chess = new Chess()
  this.studyState = null
}
LineStudier.prototype.study = function (line) {
  // Cancel the pending completion promise.
  if (this.studyState && !this.studyState.isComplete) {
    this.studyState.promiseResolveFn(false)
  }
  const studyState = new StudyState(line)
  this.chess.load(line.startPosition)
  const completionPromise = new Promise(resolve => {
    studyState.promiseResolveFn = resolve
  })
  this.studyState = studyState
  this.board.setOrientationForColor(line.color)
  this.updateBoard()
  if (line.opponentFirstMove) {
    this.applyMove(line.opponentFirstMove)
    setTimeout(this.updateBoard.bind(this), Config.OPPONENT_FIRST_MOVE_DELAY_MS)
  }
  return completionPromise
}
LineStudier.prototype.tryMove = function (move) {
  if (!this.studyState || this.studyState.isComplete) {
    throw new Error('Inappropripate call to tryMove.')
  }
  this.board.removeDrawings()
  const statisticPgn = this.chess.pgn()
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\s+(?:\*|1-0|0-1|1\/2-1\/2)\s*$/, '')
    .trim()
  const expectedMove = this.studyState.line.moves[this.studyState.moveIndex]
  if (move.fromSquare !== expectedMove.fromSquare ||
            move.toSquare !== expectedMove.toSquare) {
    this.studyState.wrongMoves++
    if (this.studyState.wrongMoves >= Config.WRONG_MOVES_FOR_ANSWER) {
      this.board.drawArrow(expectedMove.fromSquare, expectedMove.toSquare, 'red')
    } else if (this.studyState.wrongMoves >= Config.WRONG_MOVES_FOR_HINT) {
      this.board.drawCircle(expectedMove.fromSquare, 'red')
    }
    this.statisticRecorder.recordWrongMove(statisticPgn)
    this.board.flashWrongMove()
    this.updateBoard()
    return
  }
  this.statisticRecorder.recordRightMove(statisticPgn)
  this.studyState.wrongMoves = 0
  this.applyMove(expectedMove)
  this.updateBoard()
  if (this.studyState.moveIndex >= this.studyState.line.moves.length - 2) {
    this.statisticRecorder.recordFinishLine(statisticPgn)
    this.board.flashFinishLine()
    this.studyState.isComplete = true
    this.studyState.promiseResolveFn(true)
    return
  }
  this.board.flashRightMove()
  const opponentReply = this.studyState.line.moves[this.studyState.moveIndex + 1]
  this.applyMove(opponentReply)
  this.studyState.moveIndex += 2
  setTimeout(this.updateBoard.bind(this), Config.OPPONENT_REPLY_DELAY_MS)
}
LineStudier.prototype.applyMove = function (move) {
  this.chess.move({
    from: move.fromSquare,
    to: move.toSquare,
    promotion: 'q'
  })
}
LineStudier.prototype.updateBoard = function () {
  this.board.setStateFromChess(this.chess)
}

function StudyState (line) {
  this.line = line
  this.moveIndex = 0
  this.wrongMoves = 0
  this.isComplete = false
  this.promiseResolveFn = (success) => { }
}

function PickerController (store, modeManager) {
  this.store = store
  this.modeManager = modeManager
  this.model = null
  this.view = null
}
PickerController.prototype.initialize = function (model, view) {
  this.model = model
  this.view = view
}
PickerController.prototype.addMetadata = function () {
  const newRepertoireId = this.store.createRepertoire()
  this.updatePicker()
  this.selectMetadataId(newRepertoireId)
  this.modeManager.getSelectedMode().notifySelectedMetadata()
}
PickerController.prototype.selectMetadataId = function (metadataId) {
  if (!this.model || !this.view) {
    throw new Error('Not initialized yet.')
  }
  if (this.model.selectedMetadata.id === metadataId) {
    return
  }
  this.model.selectMetadataId(metadataId)
  this.view.refresh()
  this.modeManager.getSelectedMode().notifySelectedMetadata()
}
PickerController.prototype.deleteMetadataId = function (metadataId) {
  if (!this.model || !this.view) {
    throw new Error('Not initialized yet.')
  }
  const notifyMode = metadataId === this.model.selectedMetadata.id
  this.store.deleteRepertoire(metadataId)
  this.updatePicker()
  if (notifyMode) {
    this.modeManager.getSelectedMode().notifySelectedMetadata()
  }
}
PickerController.prototype.isModelEmpty = function () {
  if (!this.model) {
    throw new Error('Not initialized yet.')
  }
  return this.model.isEmpty()
}
PickerController.prototype.updatePicker = function () {
  if (!this.model || !this.view) {
    throw new Error('Not initialized yet.')
  }
  const lastSelectedMetadataId = this.model.isEmpty()
    ? null
    : this.model.selectedMetadata.id
  let metadataList = this.store.getAllRepertoireMetadata()
  if (!metadataList.length) {
    this.store.createRepertoire()
    metadataList = this.store.getAllRepertoireMetadata()
  }
  this.fillPicker(lastSelectedMetadataId, metadataList)
}
PickerController.prototype.fillPicker = function (lastSelectedMetadataId, metadataList) {
  if (!this.model || !this.view) {
    throw new Error('Not initialized yet.')
  }
  this.model.setMetadataList(metadataList, lastSelectedMetadataId)
  this.view.refresh()
}

const MAX_REPERTOIRES = 20
const pickerClasses = {
  DELETE_BUTTON: 'deleteButton',
  HOVER_BUTTON: 'hoverButton',
  METADATA: 'metadata',
  SELECTED_METADATA: 'selected'
}
function PickerView (pickerModel, pickerController, pickerElement, addMetadataElement) {
  this.pickerModel = pickerModel
  this.pickerController = pickerController
  this.pickerElement = pickerElement
  this.addMetadataElement = addMetadataElement
  this.addMetadataElement.onclick =
            () => this.pickerController.addMetadata()
}
PickerView.prototype.refresh = function () {
  // Remove all metadata children of the picker.
  const metadataChildren = document.querySelectorAll('#picker > div.metadata')
  for (let i = 0; i < metadataChildren.length; i++) {
    this.pickerElement.removeChild(metadataChildren.item(i))
  }
  // Insert the new metadata children before the add metadata button.
  const metadataList = this.pickerModel.metadataList
  const selectedIndex = this.pickerModel.selectedIndex
  for (let j = 0; j < metadataList.length; j++) {
    const newChild = this.createMetadataElement(metadataList[j], j === selectedIndex)
    this.pickerElement.insertBefore(newChild, this.addMetadataElement)
  }
  // Hide the add metadata button if the user has the maximum number of repertoires.
  const hideAddMetadataButton = metadataList.length >= MAX_REPERTOIRES
  this.addMetadataElement.classList.toggle('hidden', hideAddMetadataButton)
}
PickerView.prototype.createMetadataElement = function (metadata, isSelected) {
  const newElement = document.createElement('div')
  newElement.classList.add(pickerClasses.METADATA)
  if (isSelected) {
    newElement.classList.add(pickerClasses.SELECTED_METADATA)
  }
  const label = document.createElement('div')
  label.classList.add('metadataName')
  label.innerText = metadata.name
  const deleteButton = document.createElement('div')
  deleteButton.onclick = (e) => this.handleDeleteButton(e, metadata.id, metadata.name)
  deleteButton.classList.add(pickerClasses.HOVER_BUTTON, pickerClasses.DELETE_BUTTON)
  newElement.append(label, deleteButton)
  newElement.onclick = () => this.pickerController.selectMetadataId(metadata.id)
  return newElement
}
PickerView.prototype.handleDeleteButton = function (e, metadataId, metadataName) {
  if (window.confirm('Delete \'' + metadataName + '\'?')) {
    this.pickerController.deleteMetadataId(metadataId)
  }
  // The click should not propagate to the parent metadata element since doing
  // so would cause the repertoire being deleted to also be loaded.
  e.stopPropagation()
}

function mergePreferences (source, other) {
  const result = source
  if (other.boardStyle) result.boardStyle = other.boardStyle
  if (other.pieceStyle) result.pieceStyle = other.pieceStyle
  if (other.soundValue) result.soundValue = other.soundValue
  return result
}
function LocalRepertoireStore (localStorage) {
  this.localStorage = localStorage
}
LocalRepertoireStore.prototype.getAllRepertoireMetadata = function () {
  const stored = this.parseStorage() || {}
  const metadata = []
  for (const repertoireId in stored) {
    metadata.push({
      id: repertoireId,
      name: stored[repertoireId].name
    })
  }
  return metadata
}
LocalRepertoireStore.prototype.loadRepertoire = function (repertoireId) {
  const stored = this.parseStorage()
  if (!stored) {
    throw new Error('No stored repertoires!')
  }
  if (!stored[repertoireId]) {
    throw new Error('Repertoire to load not found in storage.')
  }
  return stored[repertoireId]
}
LocalRepertoireStore.prototype.updateRepertoire = function (repertoireId, repertoire) {
  const stored = this.parseStorage()
  if (!stored) {
    throw new Error('No stored repertoires!')
  }
  if (!stored[repertoireId]) {
    throw new Error('Repertoire to update not found in storage.')
  }
  stored[repertoireId] = repertoire
  this.storeRepertoire(stored)
}
LocalRepertoireStore.prototype.createRepertoire = function () {
  const stored = this.parseStorage() || {}
  const newRepertoireId = '' + (1 + this.getHighestKey(stored))
  stored[newRepertoireId] = {
    name: 'Untitled repertoire',
    color: 'w',
    root: null
  }
  this.storeRepertoire(stored)
  return newRepertoireId
}
LocalRepertoireStore.prototype.deleteRepertoire = function (repertoireId) {
  const stored = this.parseStorage()
  if (!stored) {
    throw new Error('No stored repertoires!')
  }
  if (!stored[repertoireId]) {
    throw new Error('Repertoire to delete not found in storage.')
  }
  delete stored[repertoireId]
  this.storeRepertoire(stored)
}
LocalRepertoireStore.prototype.setPreference = function (newPreference) {
  const mergedPreference = mergePreferences(this.getPreference(), newPreference)
  this.localStorage.setItem('preferences', JSON.stringify(mergedPreference))
}
LocalRepertoireStore.prototype.getPreference = function () {
  const rawPreference = this.localStorage.getItem('preferences')
  return rawPreference ? JSON.parse(rawPreference) : {}
}
LocalRepertoireStore.prototype.recordStatistics = function (statisticList) {
  const allStatistics = JSON.parse(this.localStorage.getItem('statistics') || '{}')
  statisticList.forEach(statistic => {
    const repertoireStatistics = allStatistics[statistic.repertoireId] || {}
    const pgnStatistics = repertoireStatistics[statistic.pgn] ||
                {
                  pgn: statistic.pgn,
                  rightMoveCount: 0,
                  wrongMoveCount: 0,
                  finishLineCount: 0
                }
    switch (statistic.statisticType) {
      case StatisticType.RIGHT_MOVE:
        pgnStatistics.rightMoveCount++
        break
      case StatisticType.WRONG_MOVE:
        pgnStatistics.wrongMoveCount++
        break
      case StatisticType.FINISH_LINE:
        pgnStatistics.finishLineCount = pgnStatistics.finishLineCount
          ? pgnStatistics.finishLineCount + 1
          : 1
        break
      default:
        throw new Error(`Unknown statistic type: ${statistic.statisticType}`)
    }
    repertoireStatistics[statistic.pgn] = pgnStatistics
    allStatistics[statistic.repertoireId] = repertoireStatistics
  })
  this.localStorage.setItem('statistics', JSON.stringify(allStatistics))
}
LocalRepertoireStore.prototype.loadStatistics = function (repertoireId) {
  const allStatistics = JSON.parse(this.localStorage.getItem('statistics') || '{}')
  const repertoireStatistics = allStatistics[repertoireId] || {}
  const statistics = []
  for (const pgn in repertoireStatistics) {
    statistics.push({
      pgn,
      rightMoveCount: repertoireStatistics[pgn].rightMoveCount || 0,
      wrongMoveCount: repertoireStatistics[pgn].wrongMoveCount || 0,
      finishLineCount: repertoireStatistics[pgn].finishLineCount || 0
    })
  }
  return statistics
}
LocalRepertoireStore.prototype.parseStorage = function () {
  const stored = this.localStorage.getItem('repertoires')
  if (!stored) {
    return null
  }
  const parsed = {}
  const map = JSON.parse(stored)
  for (const repertoireId in map) {
    const value = map[repertoireId]
    if (!value || !value.color) {
      return null
    }
    parsed[repertoireId] = {
      name: value.name,
      color: value.color,
      root: value.root || null
    }
  }
  return parsed
}
LocalRepertoireStore.prototype.storeRepertoire = function (map) {
  this.localStorage.setItem('repertoires', JSON.stringify(map))
}
LocalRepertoireStore.prototype.getHighestKey = function (map) {
  let ans = 0
  for (const repertoireId in map) {
    ans = Math.max(ans, Number.parseInt(repertoireId))
  }
  return ans
}

function CurrentRepertoireImporter (importDialog, treeModel, modeView, pickerController, updater) {
  this.importDialog = importDialog
  this.treeModel = treeModel
  this.modeView = modeView
  this.pickerController = pickerController
  this.updater = updater
  this.currentProgress = null
}
CurrentRepertoireImporter.prototype.startPgnImport = function (pgn) {
  if (this.currentProgress) {
    throw new Error('An import is already in progress!')
  }
  this.currentProgress = PgnImporter.startPgnImport(pgn)
  this.importDialog.importing = true
  this.currentProgress
    .promise
    .then(repertoire => {
      this.currentProgress = null
      this.importDialog.importing = false
      this.treeModel.loadRepertoire(repertoire)
      this.modeView.refresh()
      this.importDialog.hide()
      showStatus('Imported.')
      const store = this.updater.store
      const selectedId = this.pickerController.isModelEmpty()
        ? null
        : this.pickerController.model.selectedMetadata.id
      const repertoireId = selectedId || store.createRepertoire()
      store.updateRepertoire(repertoireId, repertoire)
      this.pickerController.updatePicker()
    })
    .catch(error => {
      this.currentProgress = null
      this.importDialog.importing = false
      this.importDialog.hideProgress()
      showStatus('Error importing PGN. ' + (error && error.message ? error.message : 'Could not load the repertoire.'))
    })
  this.maybeUpdateProgressText()
}
CurrentRepertoireImporter.prototype.cancelCurrentProgress = function () {
  if (this.currentProgress) {
    this.importDialog.hideProgress()
    this.currentProgress.cancel()
    this.currentProgress = null
  }
}
CurrentRepertoireImporter.prototype.maybeUpdateProgressText = function () {
  if (!this.currentProgress || this.currentProgress.isComplete()) {
    return
  }
  this.importDialog.showProgress(this.currentProgress.status.label)
  setTimeout(() => this.maybeUpdateProgressText(), 500)
}

function CurrentRepertoireExporter (treeModel) {
  this.treeModel = treeModel
}
CurrentRepertoireExporter.prototype.exportCurrentRepertoire = function () {
  const now = new Date()
  const linkEl = document.createElement('a')
  linkEl.style.display = 'none'
  linkEl.download = this.getExportFilename(now)
  const contents = this.getExportContents(now)
  linkEl.href = `data:application/x-chess-pgn,${contents}`
  document.body.appendChild(linkEl)
  linkEl.click()
  document.body.removeChild(linkEl)
}
CurrentRepertoireExporter.prototype.getExportContents = function (now) {
  const tags = this.getExportTags(now)
  let tagsString = ''
  for (const key in tags) {
    tagsString += `[${key} "${tags[key]}"]\n`
  }
  const moves = this.treeModel.exportToPgn()
  return encodeURIComponent(`${tagsString}\n${moves}`)
}
CurrentRepertoireExporter.prototype.getExportTags = function (now) {
  return {
    Event: this.treeModel.repertoireName,
    Site: 'https://zeitnot.hellauer.bayern/',
    UTCDate: getUtcDate(now),
    UTCTime: getUtcTime(now),
    Result: '*'
  }
}
CurrentRepertoireExporter.prototype.getExportFilename = function (now) {
  const name = this.treeModel.repertoireName
  const formattedName = name.toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]+/g, '')
    .replace(/\s+/g, '-')
  const utcDate = getUtcDate(now)
  return `zeitnot-${formattedName}_${utcDate}.pgn`
}

function BuildBoardHandler (treeModel, treeNavigator, modeView, updater) {
  this.treeModel = treeModel
  this.treeNavigator = treeNavigator
  this.modeView = modeView
  this.updater = updater
}
BuildBoardHandler.prototype.onMove = function (fromSquare, toSquare) {
  const pgn = this.treeModel.getSelectedViewInfo(NullAnnotator.INSTANCE).pgn
  const result = this.treeModel.addMove(pgn, { fromSquare, toSquare })
  if (result.success && !result.failureReason) {
    this.updater.updateCurrentRepertoire()
    return
  }
  switch (result.failureReason) {
    case AddMoveFailureReason.ILLEGAL_MOVE:
      showStatus('Couldn\'t add move. That move is illegal.')
      break
    case AddMoveFailureReason.EXCEEDED_MAXIMUM_LINE_DEPTH:
      showStatus('Couldn\'t add move. Opening lines can\'t be longer than ' +
                    Config.MAXIMUM_LINE_DEPTH_IN_PLY + ' ply.')
      break
    case AddMoveFailureReason.EXCEEDED_MAXIMUM_NUM_NODES:
      showStatus('Couldn\'t add move. Repertoires can\'t contain more than ' +
                    Config.MAXIMUM_TREE_NODES_PER_REPERTOIRE + ' total moves.')
      break
    default:
      throw new Error(`Unknown failure reason: ${result.failureReason}`)
  }
}
BuildBoardHandler.prototype.onChange = function () {
  this.modeView.refresh()
}
BuildBoardHandler.prototype.onScroll = function (e) {
  this.treeNavigator.selectFromWheelEvent(e)
}

function CurrentRepertoireUpdater (store, pickerController, treeModel) {
  this.store = store
  this.pickerController = pickerController
  this.treeModel = treeModel
}
CurrentRepertoireUpdater.prototype.updateCurrentRepertoire = function () {
  const repertoireId = this.pickerController.model.selectedMetadata.id
  const repertoire = this.treeModel.serializeRepertoire()
  this.store.updateRepertoire(repertoireId, repertoire)
}

function TreeController (treeModel, modeView, updater, exporter) {
  this.treeModel = treeModel
  this.modeView = modeView
  this.updater = updater
  this.exporter = exporter
}
TreeController.prototype.flipRepertoireColor = function () {
  this.treeModel.flipRepertoireColor()
  this.modeView.refresh()
  this.updater.updateCurrentRepertoire()
}
TreeController.prototype.trash = function () {
  if (!this.treeModel.canRemoveSelectedPgn()) {
    return
  }
  this.treeModel.removeSelectedPgn()
  this.modeView.refresh()
  this.updater.updateCurrentRepertoire()
}
TreeController.prototype.export = function () {
  this.exporter.exportCurrentRepertoire()
}

const UPDATE_DEBOUNCE_INTERVAL_MS_ = 1000
function RenameInput (renameInputElement, treeModel, pickerController, updater) {
  this.renameInputElement = renameInputElement
  this.treeModel = treeModel
  this.pickerController = pickerController
  this.updater = updater
  this.updateDebouncer = new Debouncer(() => this.update(), UPDATE_DEBOUNCE_INTERVAL_MS_)
  this.renameInputElement.oninput = () => this.onInputChange()
}
RenameInput.prototype.refresh = function () {
  this.renameInputElement.value = this.treeModel.repertoireName
}
RenameInput.prototype.isFocused = function () {
  return this.renameInputElement === document.activeElement
}
RenameInput.prototype.onInputChange = function () {
  if (!this.renameInputElement.value) {
    this.renameInputElement.value = 'Untitled repertoire'
  }
  this.treeModel.repertoireName = this.renameInputElement.value
  this.updateDebouncer.fire()
}
RenameInput.prototype.update = function () {
  this.updater.updateCurrentRepertoire()
  this.pickerController.updatePicker()
}

function ColorChooser (selectEl, treeModel, modeView, updater) {
  this.selectEl = selectEl
  this.treeModel = treeModel
  this.modeView = modeView
  this.updater = updater
  selectEl.onchange = () => this.handleClick(selectEl.value)
}
ColorChooser.prototype.refresh = function () {
  this.selectEl.value = this.treeModel.repertoireColor
}
ColorChooser.prototype.handleClick = function (color) {
  this.treeModel.repertoireColor = color
  this.modeView.refresh()
  this.updater.updateCurrentRepertoire()
}

function ExampleRepertoireHandler (treeModel, modeView, pickerController, updater) {
  this.treeModel = treeModel
  this.modeView = modeView
  this.pickerController = pickerController
  this.updater = updater
}
ExampleRepertoireHandler.prototype.handleButtonClicks = function (exampleRepertoireElement) {
  exampleRepertoireElement.onclick = this.handleClick.bind(this)
}
ExampleRepertoireHandler.prototype.handleClick = function () {
  const exampleJson = JSON.parse(ExampleRepertoires.KINGS_GAMBIT)
  this.treeModel.loadRepertoire(exampleJson)
  this.modeView.refresh()
  this.updater.updateCurrentRepertoire()
  this.pickerController.updatePicker()
}

function BuildMode (store, pickerController, modeManager, soundPlayer) {
  this.store = store
  this.pickerController = pickerController
  this.modeManager = modeManager
  this.treeModel = new TreeModel()
  this.buildModeView = new ViewList()
  const currentRepertoireUpdater = new CurrentRepertoireUpdater(store, pickerController, this.treeModel)
  const currentRepertoireExporter = new CurrentRepertoireExporter(this.treeModel)
  this.renameInput = new RenameInput(assert(document.getElementById('renameInput')), this.treeModel, pickerController, currentRepertoireUpdater)
  this.buildModeView.addView(this.renameInput)
  this.treeNavigator = new TreeNavigator(this.treeModel, this.buildModeView)
  const handler = new BuildBoardHandler(this.treeModel, this.treeNavigator, this.buildModeView, currentRepertoireUpdater)
  this.board = new OpeningBoard(assert(document.getElementById('buildBoard')), handler, soundPlayer, false)
  const treeNodeHandler = new TreeNodeHandler(this.treeModel, this.buildModeView)
  const treeView = new TreeView(assert(document.getElementById('buildTreeViewInner')), assert(document.getElementById('buildTreeViewOuter')), this.treeModel, treeNodeHandler, this.board, new DefaultAnnotator(), new DefaultAnnotationRenderer())
  this.buildModeView.addView(treeView)
  const colorChooser = new ColorChooser(assert(document.getElementById('colorChooser')), this.treeModel, this.buildModeView, currentRepertoireUpdater)
  this.buildModeView.addView(colorChooser)
  this.treeController = new TreeController(this.treeModel, this.buildModeView, currentRepertoireUpdater, currentRepertoireExporter)
  const treeButtons = new TreeButtons(assert(document.getElementById('buildTreeButtons')), this.treeModel)
  treeButtons
    .addNavigationButtons(assert(document.getElementById('buildTreeLeft')), assert(document.getElementById('buildTreeRight')), this.treeNavigator)
    .addButton({
      buttonEl: assert(document.getElementById('buildTreeTrash')),
      handleClick: () => this.treeController.trash(),
      isEnabled: () => this.treeModel.canRemoveSelectedPgn()
    })
    .addButton({
      buttonEl: assert(document.getElementById('buildTreeExport')),
      handleClick: () => this.treeController.export(),
      isEnabled: () => true
    })
  this.buildModeView.addView(treeButtons)
  const emptyMessage = new EmptyMessage(this.treeModel, assert(document.getElementById('emptyBuild')))
  this.buildModeView.addView(emptyMessage)
  const exampleRepertoireHandler = new ExampleRepertoireHandler(this.treeModel, this.buildModeView, pickerController, currentRepertoireUpdater)
  exampleRepertoireHandler.handleButtonClicks(assert(document.getElementById('exampleRepertoire')))
  this.importDialog = new ImportDialog(document.getElementById('importPgnTextArea'), document.getElementById('importPgnUpload'), assert(document.getElementById('importPgnOk')), assert(document.getElementById('importStatus')))
  const currentRepertoireImporter = new CurrentRepertoireImporter(this.importDialog, this.treeModel, this.buildModeView, pickerController, currentRepertoireUpdater)
  this.importDialog.setImporter(currentRepertoireImporter)
  this.buildModeElement = assert(document.getElementById('buildMode'))
  this.buildButton = assert(document.getElementById('buildButton'))
}
BuildMode.prototype.preEnter = function () {
  this.board.setInitialPositionImmediately()
  this.pickerController.updatePicker()
  this.notifySelectedMetadata()
}
BuildMode.prototype.exit = function () {
  this.buildModeElement.classList.add('hidden')
  this.buildButton.classList.remove('selectedMode')
}
BuildMode.prototype.postEnter = function () {
  this.buildModeElement.classList.remove('hidden')
  this.buildButton.classList.add('selectedMode')
}
BuildMode.prototype.onKeyDown = function (e) {
  if (this.renameInput.isFocused()) {
    return
  }
  if (this.importDialog.isVisible()) {
    this.importDialog.onKeyDown(e)
    return
  }
  if (e.keyCode === 83) {
    this.modeManager.selectModeType(ModeType.STUDY) // S
  } else if (e.keyCode === 82) {
    this.modeManager.selectModeType(ModeType.EVALUATE) // R
  } else if (e.keyCode === 70) {
    this.treeController.flipRepertoireColor() // F
  } else if (e.keyCode === 37) {
    this.treeNavigator.selectLeft() // Left arrow
    e.preventDefault()
  } else if (e.keyCode === 38) {
    this.treeNavigator.selectUp() // Up arrow
    e.preventDefault()
  } else if (e.keyCode === 39) {
    this.treeNavigator.selectRight() // Right arrow
    e.preventDefault()
  } else if (e.keyCode === 40) {
    this.treeNavigator.selectDown() // Down arrow
    e.preventDefault()
  } else if (e.keyCode === 8) {
    this.treeController.trash() // Backspace
  }
}
BuildMode.prototype.notifySelectedMetadata = function () {
  if (this.pickerController.isModelEmpty()) return
  const selectedMetadataId = this.pickerController.model.selectedMetadata.id
  this.onLoadRepertoire(this.store.loadRepertoire(selectedMetadataId))
}
BuildMode.prototype.onLoadRepertoire = function (repertoire) {
  this.treeModel.loadRepertoire(repertoire)
  this.buildModeView.refresh()
}

function ReviewStatistics (store, repertoireId) {
  this.rightMoveCounts = new Map()
  this.wrongMoveCounts = new Map()
  this.finishLineCount = 0
  this.rightMoveCount = 0
  this.wrongMoveCount = 0

  const statistics = store.loadStatistics(repertoireId)
  statistics.forEach((entry) => {
    this.rightMoveCounts.set(entry.pgn, entry.rightMoveCount)
    this.wrongMoveCounts.set(entry.pgn, entry.wrongMoveCount)
    this.finishLineCount += entry.finishLineCount
  })
  this.rightMoveCount = this.sum(this.rightMoveCounts)
  this.wrongMoveCount = this.sum(this.wrongMoveCounts)
}
ReviewStatistics.prototype.sum = function (counts) {
  return Array.from(counts.values()).reduce((total, count) => total + count, 0)
}
ReviewStatistics.prototype.rightMoveCountFor = function (pgn) {
  return this.rightMoveCounts.get(pgn) || 0
}
ReviewStatistics.prototype.wrongMoveCountFor = function (pgn) {
  return this.wrongMoveCounts.get(pgn) || 0
}

function InsightCalculator (treeModel, statistics) {
  this.treeModel = treeModel
  this.statistics = statistics
}
InsightCalculator.prototype.calculate = function () {
  let lineCount = 0
  let positionCount = 0
  this.treeModel.traverseDepthFirst(viewInfo => {
    positionCount++
    if (!viewInfo.numChildren) {
      lineCount++
    }
  }, NullAnnotator.INSTANCE)
  return [
    'In this repertoire...',
    {
      title: 'Number of lines',
      value: lineCount,
      tone: 'insightGray'
    },
    {
      title: 'Number of positions',
      value: positionCount,
      tone: 'insightGray'
    },
    {
      title: 'Times you finished studying a line',
      value: this.statistics.finishLineCount,
      tone: 'insightYellow'
    },
    {
      title: 'Times you played a correct move while studying',
      value: this.statistics.rightMoveCount,
      tone: 'insightGreen'
    },
    {
      title: 'Times you played a wrong move while studying',
      value: this.statistics.wrongMoveCount,
      tone: 'insightRed'
    },
    'For the selected position...',
    {
      title: 'Times you played the correct move',
      value: this.statistics.rightMoveCountFor(this.treeModel.getSelectedViewInfo(NullAnnotator.INSTANCE).pgn),
      tone: 'insightGreen'
    },
    {
      title: 'Times you played the wrong move',
      value: this.statistics.wrongMoveCountFor(this.treeModel.getSelectedViewInfo(NullAnnotator.INSTANCE).pgn),
      tone: 'insightRed'
    }
  ]
}

const insightClass = {
  insight: 'insight',
  title: 'insightTitle',
  value: 'insightValue',
  label: 'insightLabel'
}
function InsightsPanel (insightsEl, calculator) {
  this.insightsEl = insightsEl
  this.calculator = calculator
}
InsightsPanel.prototype.refresh = function () {
  this.insightsEl.innerHTML = ''
  this.calculator.calculate().forEach(e => this.handleElement(e))
}
InsightsPanel.prototype.handleElement = function (e) {
  typeof e === 'string'
    ? this.handleInsightLabel(e)
    : this.handleInsight(e)
}
InsightsPanel.prototype.handleInsight = function (insight) {
  const titleEl = document.createElement('div')
  titleEl.classList.add(insightClass.title, insight.tone)
  titleEl.innerText = insight.title
  const valueEl = document.createElement('div')
  valueEl.classList.add(insightClass.value, insight.tone)
  valueEl.innerText = `${insight.value}`
  const insightEl = document.createElement('div')
  insightEl.classList.add(insightClass.insight)
  insightEl.appendChild(titleEl)
  insightEl.appendChild(valueEl)
  this.insightsEl.appendChild(insightEl)
}
InsightsPanel.prototype.handleInsightLabel = function (insightLabel) {
  const labelEl = document.createElement('div')
  labelEl.classList.add(insightClass.label)
  labelEl.innerText = insightLabel
  this.insightsEl.appendChild(labelEl)
}

function ZeroStatistics () {
  this.finishLineCount = 0
  this.rightMoveCount = 0
  this.wrongMoveCount = 0
}
ZeroStatistics.prototype.rightMoveCountFor = function () {
  return 0
}
ZeroStatistics.prototype.wrongMoveCountFor = function () {
  return 0
}

function DelegatingStatistics () {
  this.delegate = new ZeroStatistics()
  this.finishLineCount = 0
  this.rightMoveCount = 0
  this.wrongMoveCount = 0
}
DelegatingStatistics.prototype.setDelegate = function (delegate) {
  this.delegate = delegate
  this.finishLineCount = delegate.finishLineCount
  this.rightMoveCount = delegate.rightMoveCount
  this.wrongMoveCount = delegate.wrongMoveCount
}
DelegatingStatistics.prototype.rightMoveCountFor = function (pgn) {
  return this.delegate.rightMoveCountFor(pgn)
}
DelegatingStatistics.prototype.wrongMoveCountFor = function (pgn) {
  return this.delegate.wrongMoveCountFor(pgn)
}

function StatisticAnnotator (statistics) {
  this.statistics = statistics
}
StatisticAnnotator.prototype.annotate = function (node) {
  return {
    rightMoveCount: this.statistics.rightMoveCountFor(node.pgn),
    wrongMoveCount: this.statistics.wrongMoveCountFor(node.pgn)
  }
}

function StatisticAnnotationRenderer () {}
StatisticAnnotationRenderer.prototype.renderAnnotation = function (annotation, treeNodeElement) {
  const totalCount = annotation.rightMoveCount + annotation.wrongMoveCount
  if (!totalCount) return
  treeNodeElement.classList.add('studied')
  treeNodeElement.style.setProperty('--right-ratio', annotation.rightMoveCount / totalCount)
  treeNodeElement.title = annotation.rightMoveCount + ' right, ' + annotation.wrongMoveCount + ' wrong'
}

function RepertoireNameLabel (labelEl, treeModel) {
  this.labelEl = labelEl
  this.treeModel = treeModel
}
RepertoireNameLabel.prototype.refresh = function () {
  this.labelEl.innerText = this.treeModel.repertoireName
}

function ChildMoveDrawer (treeModel, board) {
  this.treeModel = treeModel
  this.board = board
}
ChildMoveDrawer.prototype.refresh = function () {
  this.board.removeDrawings()
  const selectedViewInfo = this.treeModel.getSelectedViewInfo(NullAnnotator.INSTANCE)
  selectedViewInfo.childMoves.forEach(m => this.board.drawArrow(m.fromSquare, m.toSquare, 'green'))
}

function EvaluateBoardHandler (treeNavigator) {
  this.treeNavigator = treeNavigator
}
EvaluateBoardHandler.prototype.onMove = function (from, to) { }
EvaluateBoardHandler.prototype.onChange = function () { }
EvaluateBoardHandler.prototype.onScroll = function (e) {
  this.treeNavigator.selectFromWheelEvent(e)
}

function EvaluateMode (store, pickerController, modeManager) {
  this.store = store
  this.pickerController = pickerController
  this.modeManager = modeManager
  this.evaluateModeElement = assert(document.getElementById('evaluateMode'))
  this.evaluateButton = assert(document.getElementById('evaluateButton'))
  this.modeView = new ViewList()
  this.treeModel = new TreeModel()
  this.treeNavigator = new TreeNavigator(this.treeModel, this.modeView)
  this.statistics = new DelegatingStatistics()
  this.board = new OpeningBoard(assert(document.getElementById('evaluateBoard')), new EvaluateBoardHandler(this.treeNavigator), null, true)
  this.createEmptyMessage()
  this.createChildMoveDrawer()
  this.createTreeView()
  this.createTreeButtons()
  this.createRepertoireNameLabel()
  this.createInsightsPanel()
}
EvaluateMode.prototype.createEmptyMessage = function () {
  const emptyMessage = new EmptyMessage(this.treeModel, assert(document.getElementById('emptyEvaluate')))
  this.modeView.addView(emptyMessage)
}
EvaluateMode.prototype.createChildMoveDrawer = function () {
  const childMoveDrawer = new ChildMoveDrawer(this.treeModel, this.board)
  this.modeView.addView(childMoveDrawer)
}
EvaluateMode.prototype.createTreeView = function () {
  const treeView = new TreeView(assert(document.getElementById('evaluateTreeViewInner')), assert(document.getElementById('evaluateTreeViewOuter')), this.treeModel, new TreeNodeHandler(this.treeModel, this.modeView), this.board, new StatisticAnnotator(this.statistics), new StatisticAnnotationRenderer())
  this.modeView.addView(treeView)
}
EvaluateMode.prototype.createTreeButtons = function () {
  const treeButtons = new TreeButtons(assert(document.getElementById('evaluateTreeButtons')), this.treeModel)
  treeButtons
    .addNavigationButtons(assert(document.getElementById('evaluateTreeLeft')), assert(document.getElementById('evaluateTreeRight')), this.treeNavigator)
  this.modeView.addView(treeButtons)
}
EvaluateMode.prototype.createRepertoireNameLabel = function () {
  const repertoireNameLabel = new RepertoireNameLabel(assert(document.getElementById('repertoireNameLabel')), this.treeModel)
  this.modeView.addView(repertoireNameLabel)
}
EvaluateMode.prototype.createInsightsPanel = function () {
  const calculator = new InsightCalculator(this.treeModel, this.statistics)
  const panel = new InsightsPanel(assert(document.getElementById('insightsPanel')), calculator)
  this.modeView.addView(panel)
}
EvaluateMode.prototype.preEnter = function () {
  this.board.setInitialPositionImmediately()
  this.pickerController.updatePicker()
  this.notifySelectedMetadata()
}
EvaluateMode.prototype.exit = function () {
  this.toggleEvaluteUi(false)
}
EvaluateMode.prototype.postEnter = function () {
  this.toggleEvaluteUi(true)
}
EvaluateMode.prototype.onKeyDown = function (e) {
  if (e.keyCode === 83) {
    this.modeManager.selectModeType(ModeType.STUDY) // S
  } else if (e.keyCode === 66) {
    this.modeManager.selectModeType(ModeType.BUILD) // B
  } else if (e.keyCode === 37) {
    this.treeNavigator.selectLeft() // Left arrow
    e.preventDefault()
  } else if (e.keyCode === 38) {
    this.treeNavigator.selectUp() // Up arrow
    e.preventDefault()
  } else if (e.keyCode === 39) {
    this.treeNavigator.selectRight() // Right arrow
    e.preventDefault()
  } else if (e.keyCode === 40) {
    this.treeNavigator.selectDown() // Down arrow
    e.preventDefault()
  }
}
EvaluateMode.prototype.notifySelectedMetadata = function () {
  if (this.pickerController.isModelEmpty()) return
  const selectedMetadataId = this.pickerController.model.selectedMetadata.id
  const repertoire = this.store.loadRepertoire(selectedMetadataId)
  this.treeModel.loadRepertoire(repertoire)
  this.statistics.setDelegate(new ReviewStatistics(this.store, selectedMetadataId))
  this.modeView.refresh()
  // Arrows on the review board are measured after layout, so draw them again.
  setTimeout(() => this.modeView.refresh(), 0)
}
EvaluateMode.prototype.toggleEvaluteUi = function (enable) {
  this.evaluateModeElement.classList.toggle('hidden', !enable)
  this.evaluateButton.classList.toggle('selectedMode', enable)
}

function LineShuffler () {}

LineShuffler.shuffle = function (lines) {
  const ans = []
  for (let i = 0; i < lines.length; i++) {
    ans[i] = lines[i]
  }
  for (let i = 0; i < lines.length; i++) {
    const swapIndex = i + Math.floor(Math.random() * (lines.length - i))
    const dummy = ans[i]
    ans[i] = ans[swapIndex]
    ans[swapIndex] = dummy
  }
  return ans
}

const SHUFFLE_TIME_MS = 700
const NEXT_LINE_DELAY_MS = 1200
function LineListStudier (lineStudier, messageEl) {
  this.lineStudier = lineStudier
  this.messageEl = messageEl
  this.currentTimeout = null
}
LineListStudier.prototype.cancelStudy = function () {
  if (this.currentTimeout !== null) {
    clearTimeout(this.currentTimeout)
    this.currentTimeout = null
  }
}
LineListStudier.prototype.study = function (lines) {
  if (!lines.length) {
    throw new Error('Need at least one line to study.')
  }
  this.cancelStudy()
  this.studyLine(lines, lines.length)
}
LineListStudier.prototype.studyLine = function (shuffledLines, lineIndex) {
  if (lineIndex >= shuffledLines.length) {
    this.messageEl.innerText = `Shuffling ${shuffledLines.length} lines...`
    this.messageEl.classList.remove('hidden')
    this.currentTimeout = setTimeout(() => this.studyLine(LineShuffler.shuffle(shuffledLines), 0), SHUFFLE_TIME_MS)
    return
  }
  this.messageEl.innerText = `${lineIndex} / ${shuffledLines.length} lines ` +
            'studied'
  this.lineStudier.study(shuffledLines[lineIndex]).then(success => {
    if (success) {
      this.messageEl.innerText = `${lineIndex + 1} / ` +
                    `${shuffledLines.length} lines studied`
      this.currentTimeout = setTimeout(() => this.studyLine(shuffledLines, lineIndex + 1), NEXT_LINE_DELAY_MS)
    }
  })
}

function Line (startPosition, opponentFirstMove, moves, color) {
  this.startPosition = startPosition
  this.opponentFirstMove = opponentFirstMove
  this.moves = moves
  this.color = color
}

Line.fromPgnForInitialPosition = function (pgn, color) {
  const chess = new Chess()
  try {
    chess.loadPgn(pgn)
  } catch (e) {
    throw new Error('Invalid PGN: ' + pgn)
  }
  let opponentFirstMove = null
  const history = chess.history({ verbose: true })
  const moves = history.map(m => {
    return {
      fromSquare: m.from,
      toSquare: m.to
    }
  })
  if (color === 'b') {
    opponentFirstMove = moves.splice(0, 1)[0]
  }
  return new Line('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', opponentFirstMove, moves, color)
}

function LineEmitter () {}

LineEmitter.emitForModel = function (treeModel) {
  const lines = []
  treeModel.traverseDepthFirst(viewInfo => {
    const isLeafNode = !viewInfo.numChildren
    if (isLeafNode) {
      const line = Line.fromPgnForInitialPosition(viewInfo.pgn, treeModel.repertoireColor)
      lines.push(line)
    }
  }, NullAnnotator.INSTANCE)
  return lines
}

function StudyBoardHandler (lineStudier) {
  this.lineStudier = lineStudier
}
StudyBoardHandler.prototype.onMove = function (fromSquare, toSquare) {
  this.lineStudier.tryMove({ fromSquare, toSquare })
}
StudyBoardHandler.prototype.onChange = function () { }
StudyBoardHandler.prototype.onScroll = function () { }

function StatisticRecorder (pickerController, store, debounceIntervalMs) {
  this.pickerController = pickerController
  this.store = store
  this.debouncer = new Debouncer(() => this.save(), debounceIntervalMs)
  this.pending = []
}
StatisticRecorder.prototype.recordRightMove = function (pgn) {
  this.recordStatistic(pgn, StatisticType.RIGHT_MOVE)
}
StatisticRecorder.prototype.recordWrongMove = function (pgn) {
  this.recordStatistic(pgn, StatisticType.WRONG_MOVE)
}
StatisticRecorder.prototype.recordFinishLine = function (pgn) {
  this.recordStatistic(pgn, StatisticType.FINISH_LINE)
}
StatisticRecorder.prototype.recordStatistic = function (pgn, statisticType) {
  const repertoireId = this.pickerController.model.selectedMetadata.id
  this.pending.push({ repertoireId, pgn, statisticType })
  this.debouncer.fire()
}
StatisticRecorder.prototype.save = function () {
  this.store.recordStatistics(this.pending)
  this.pending = []
}

function StudyMode (store, pickerController, modeManager, soundPlayer) {
  this.store = store
  this.pickerController = pickerController
  this.modeManager = modeManager
  this.treeModel = new TreeModel()
  const statisticRecorder = new StatisticRecorder(pickerController, store, 10000)
  const lineStudier = new LineStudier(statisticRecorder, null)
  this.lineListStudier = new LineListStudier(lineStudier, assert(document.getElementById('studyMessage')))
  const handler = new StudyBoardHandler(lineStudier)
  this.board = new OpeningBoard(assert(document.getElementById('studyBoard')), handler, soundPlayer, false)
  lineStudier.board = this.board
  this.studyModeElement = assert(document.getElementById('studyMode'))
  this.studyButton = assert(document.getElementById('studyButton'))
}
StudyMode.prototype.preEnter = function () {
  this.board.setInitialPositionImmediately()
  this.pickerController.updatePicker()
  this.notifySelectedMetadata()
}
StudyMode.prototype.exit = function () {
  this.studyModeElement.classList.add('hidden')
  this.studyButton.classList.remove('selectedMode')
}
StudyMode.prototype.postEnter = function () {
  this.studyModeElement.classList.remove('hidden')
  this.studyButton.classList.add('selectedMode')
}
StudyMode.prototype.onKeyDown = function (e) {
  if (e.keyCode === 66) {
    this.modeManager.selectModeType(ModeType.BUILD) // B
  } else if (e.keyCode === 82) {
    this.modeManager.selectModeType(ModeType.EVALUATE) // R
  }
}
StudyMode.prototype.notifySelectedMetadata = function () {
  if (this.pickerController.isModelEmpty()) return
  const selectedMetadataId = this.pickerController.model.selectedMetadata.id
  this.onLoadRepertoire(this.store.loadRepertoire(selectedMetadataId))
}
StudyMode.prototype.onLoadRepertoire = function (repertoire) {
  this.treeModel.loadRepertoire(repertoire)
  this.board.setInitialPositionImmediately()
  this.board.setOrientationForColor(this.treeModel.repertoireColor)
  const emptyStudyElement = assert(document.getElementById('emptyStudy'))
  const studyMessage = assert(document.getElementById('studyMessage'))
  if (this.treeModel.isEmpty()) {
    emptyStudyElement.classList.remove('hidden')
    studyMessage.classList.add('hidden')
    this.lineListStudier.cancelStudy()
    return
  }
  emptyStudyElement.classList.add('hidden')
  const lines = LineEmitter.emitForModel(this.treeModel)
  this.lineListStudier.study(lines)
}

const SHARECHESS_BOARDS = ['asphalt1.user.css', 'asphalt2.user.css', 'asphalt3.user.css', 'asphalt4.user.css', 'avocado.user.css', 'azure.user.css', 'bahia.user.css', 'bay.user.css', 'botez.user.css', 'cadillac.user.css', 'camelot.user.css', 'carnation.user.css', 'casal.user.css', 'chessception_brown.user.css', 'chessception_green.user.css', 'chessception_pink.user.css', 'chessception_violet.user.css', 'clay.user.css', 'clouds_acapulco.user.css', 'clouds_bermuda.user.css', 'clouds_cucumber.user.css', 'clouds_gimblet.user.css', 'clouds_kimberly.user.css', 'clouds_rose.user.css', 'clouds_sandal.user.css', 'clouds_wisteria.user.css', 'conifer.user.css', 'contrast_a.user.css', 'contrast_b.user.css', 'contrast_c.user.css', 'contrast_d.user.css', 'copper.user.css', 'danny.user.css', 'danny_blue.user.css', 'danny_cyan.user.css', 'danny_green.user.css', 'danny_pink.user.css', 'danny_purple.user.css', 'danny_red.user.css', 'danny_yellow.user.css', 'danya.user.css', 'flamingo.user.css', 'fuzzy.user.css', 'grass1.user.css', 'grass2.user.css', 'grass3.user.css', 'grass4.user.css', 'gulf.user.css', 'halloween_green.user.css', 'halloween_purple.user.css', 'halloween_swamp.user.css', 'halloween_web.user.css', 'havelock.user.css', 'husk.user.css', 'jaffa.user.css', 'keppel.user.css', 'leather1.user.css', 'leather2.user.css', 'leather3.user.css', 'leather4.user.css', 'leko.user.css', 'lichess.user.css', 'lila.user.css', 'lines_alabaster.user.css', 'lines_cardboard.user.css', 'lines_paper.user.css', 'lines_parchment.user.css', 'mandy.user.css', 'marino.user.css', 'meadow.user.css', 'mist.user.css', 'mona.user.css', 'mono_affair.user.css', 'mono_amazon.user.css', 'mono_asparagus.user.css', 'mono_beaver.user.css', 'mono_blue.user.css', 'mono_bw.user.css', 'mono_bw2.user.css', 'mono_cadillac.user.css', 'mono_chico.user.css', 'mono_contessa.user.css', 'mono_coper.user.css', 'mono_coral.user.css', 'mono_cornflower.user.css', 'mono_dodger.user.css', 'mono_flamingo.user.css', 'mono_goblin.user.css', 'mono_harvest.user.css', 'mono_heliotrope.user.css', 'mono_kashmir.user.css', 'mono_mahogany.user.css', 'mono_mantis.user.css', 'mono_meadow.user.css', 'mono_mobster.user.css', 'mono_mojo.user.css', 'mono_mulberry.user.css', 'mono_nevada.user.css', 'mono_rose.user.css', 'mono_sharechess_dark.user.css', 'mono_sharechess_light.user.css', 'mono_sycamore.user.css', 'mono_teal.user.css', 'mono_terracotta.user.css', 'mud.user.css', 'mule.user.css', 'nevada.user.css', 'nobel.user.css', 'observatory.user.css', 'olive.user.css', 'oracle.user.css', 'orange.user.css', 'oxford.user.css', 'patina.user.css', 'peach.user.css', 'picont.user.css', 'pigeon.user.css', 'plain_blue.user.css', 'plain_green.user.css', 'plain_pink.user.css', 'plain_purple.user.css', 'qootee.user.css', 'qootee_grape.user.css', 'qootee_pink.user.css', 'qootee_summer.user.css', 'rainbow.user.css', 'rainbow_dark.user.css', 'rainbow_light.user.css', 'rainbow_night.user.css', 'rhino.user.css', 'rock.user.css', 'ronchi.user.css', 'rose.user.css', 'russett.user.css', 'salad.user.css', 'salmon.user.css', 'sienna.user.css', 'silk.user.css', 'sirocco.user.css', 'smooth_forest.user.css', 'smooth_laguna.user.css', 'smooth_mono.user.css', 'smooth_sea.user.css', 'smooth_spring.user.css', 'smooth_summer.user.css', 'smooth_sunset.user.css', 'smooth_violet.user.css', 'spring.user.css', 'spun.user.css', 'standard.user.css', 'sulu.user.css', 'sushi.user.css', 'tangerine.user.css', 'turmeric.user.css', 'violet.user.css', 'wood1.user.css', 'wood10.user.css', 'wood11.user.css', 'wood12.user.css', 'wood13.user.css', 'wood14.user.css', 'wood15.user.css', 'wood16.user.css', 'wood2.user.css', 'wood3.user.css', 'wood4.user.css', 'wood5.user.css', 'wood6.user.css', 'wood7.user.css', 'wood8.user.css', 'wood9.user.css', 'york.user.css']
const SHARECHESS_PIECE_SETS = [
  'adventurer',
  'adventurer_berry',
  'adventurer_brown',
  'adventurer_grass',
  'alfarishy',
  'alfarishy_berry',
  'alfarishy_blue',
  'alfarishy_pink',
  'alfonso-x',
  'alfonso-x_brown',
  'alfonso-x_grape',
  'alfonso-x_toy',
  'alpha',
  'alpha_ink',
  'alpha_mint',
  'alpha_wood',
  'anarchy',
  'anarchy-plug',
  'anarchy-plug_candy',
  'anarchy-plug_fresh',
  'anarchy-plug_sepia',
  'anarchy_candy',
  'anarchy_fresh',
  'anarchy_halloween',
  'anarchy_sepia',
  'berlin',
  'berlin_blue',
  'berlin_loulou',
  'berlin_maroon',
  'caliente',
  'caliente_blue',
  'caliente_pink',
  'caliente_wood',
  'california',
  'california_brown',
  'california_green',
  'california_red',
  'cardinal',
  'cardinal_blue',
  'cardinal_brown',
  'cardinal_green',
  'cases',
  'cases_cocoa',
  'cases_forest',
  'cases_gray',
  'cburnett',
  'cburnett_blue',
  'cburnett_brown',
  'cburnett_purple',
  'checkers',
  'checkers_cute',
  'checkers_grape',
  'checkers_wood',
  'chess7',
  'chess7_calm',
  'chess7_pink',
  'chess7_yellow',
  'chessnut',
  'chessnut_blue',
  'chessnut_brown',
  'chessnut_burgundy',
  'companion',
  'companion_cyan',
  'companion_eggplant',
  'companion_red',
  'condal',
  'condal_cold',
  'condal_halloween',
  'condal_mustard',
  'condal_warm',
  'dmuysi',
  'dmuysi_cotton',
  'dmuysi_kournikova',
  'dmuysi_marzipan',
  'dubrovny',
  'dubrovny_brown',
  'dubrovny_bw',
  'dubrovny_green',
  'echiquier',
  'echiquier_flesh',
  'echiquier_grape',
  'echiquier_ink',
  'fantasy',
  'fantasy_calm',
  'fantasy_cold',
  'fantasy_warm',
  'fly-or-dream',
  'fly-or-dream_fire',
  'fly-or-dream_magic',
  'fly-or-dream_rainbow',
  'fresca',
  'fresca_camelot',
  'fresca_matisse',
  'fresca_zucchini',
  'gioco',
  'gioco_metal',
  'gioco_purple',
  'gioco_wood',
  'governor',
  'governor_bw',
  'governor_patina',
  'governor_purple',
  'harlequin',
  'harlequin_gold',
  'harlequin_neon',
  'harlequin_peach',
  'horsey',
  'horsey_blue',
  'horsey_pink',
  'horsey_purple',
  'icon54',
  'icon54_brown',
  'icon54_gray',
  'icon54_neon',
  'icpieces',
  'icpieces_blue',
  'icpieces_brown',
  'icpieces_maroon',
  'kingdom',
  'kingdom_blue',
  'kingdom_brown',
  'kingdom_sulu',
  'kosal',
  'kosal_blue',
  'kosal_red',
  'kosal_violet',
  'leipzig',
  'leipzig_berry',
  'leipzig_nature',
  'leipzig_niagara',
  'letters',
  'letters_cold',
  'letters_dim',
  'letters_warm',
  'libra',
  'libra_plum',
  'libra_sea',
  'libra_wood',
  'line',
  'line_berry',
  'line_purple',
  'line_toy',
  'lucena',
  'lucena_blue',
  'lucena_brown',
  'lucena_pink',
  'maestro',
  'maestro_blue',
  'maestro_brown',
  'maestro_pink',
  'magnetic',
  'magnetic_brown',
  'magnetic_lila',
  'magnetic_orange',
  'mark',
  'mark_brown',
  'mark_grape',
  'mark_green',
  'marroquin',
  'marroquin_eggplant',
  'marroquin_rajah',
  'marroquin_toy',
  'maya',
  'maya_brown',
  'maya_cold',
  'maya_warm',
  'mediaeval',
  'mediaeval_brown',
  'mediaeval_green',
  'mediaeval_orange',
  'merida',
  'merida_cyan',
  'merida_ink',
  'merida_traffic',
  'millennia',
  'millennia_blue',
  'millennia_green',
  'millennia_sand',
  'motif',
  'motif_green',
  'motif_maroon',
  'motif_purple',
  'oldstyle',
  'oldstyle_bondi',
  'oldstyle_brown',
  'oldstyle_gossip',
  'pirat',
  'pirat_maroon',
  'pirat_peach',
  'pirat_sea',
  'pirouetti',
  'pirouetti_border',
  'pirouetti_border_coral',
  'pirouetti_border_grass',
  'pirouetti_border_winter',
  'pirouetti_dream',
  'pirouetti_mint',
  'pirouetti_summer',
  'pixel',
  'pixel_juicy',
  'pixel_neon',
  'pixel_spring',
  'qootee',
  'qootee_grape',
  'qootee_pink',
  'qootee_summer',
  'regular',
  'regular_green',
  'regular_ink',
  'regular_purple',
  'reillycraig',
  'reillycraig_dixie',
  'reillycraig_lawn',
  'reillycraig_tamarind',
  'riohacha',
  'riohacha_cute',
  'riohacha_spring',
  'riohacha_winter',
  'saakyan',
  'saakyan_blue',
  'saakyan_coco',
  'saakyan_grape',
  'shapes',
  'shapes_blue',
  'shapes_brown',
  'shapes_cute',
  'smart',
  'smart_apricot',
  'smart_blue',
  'smart_cocoa',
  'spatial',
  'spatial_blue',
  'spatial_salmon',
  'spatial_summer',
  'staunty',
  'staunty_blue',
  'staunty_lila',
  'staunty_wood',
  'symmetric',
  'symmetric_blue',
  'symmetric_brown',
  'symmetric_purple',
  'tagged',
  'tatiana',
  'tatiana_calm',
  'tatiana_sweet',
  'tatiana_wood',
  'tfb',
  'tfb_brown',
  'tfb_green',
  'tfb_purple',
  'traveller',
  'traveller_blue',
  'traveller_brown',
  'traveller_green',
  'trendy',
  'trendy_brown',
  'trendy_fresh',
  'trendy_ink',
  'utrecht',
  'utrecht_crimson',
  'utrecht_mirage',
  'utrecht_violet',
  'vecon',
  'vecon_baltic',
  'vecon_cute',
  'vecon_hemlock',
  'wisdom',
  'wisdom_blue',
  'wisdom_brown',
  'wisdom_grape'
]
const DEFAULT_PIECE_STYLE = 'berlin'
const DEFAULT_BOARD_STYLE = 'lines_alabaster.user.css'

function styleLabel (fileName) {
  return fileName.replace(/\.user\.css$/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function installShareChessSprite (svgText) {
  let wrapper = document.getElementById('cm-chessboard-sprite')
  if (!wrapper) {
    wrapper = document.createElement('div')
    wrapper.id = 'cm-chessboard-sprite'
    wrapper.style.transform = 'scale(0)'
    wrapper.style.position = 'absolute'
    wrapper.setAttribute('aria-hidden', 'true')
    document.body.appendChild(wrapper)
  }
  wrapper.innerHTML = svgText
  ;(window.shareChessBoards || []).forEach((board) => board.view.redrawPieces())
}

function buildShareChessSprite (setName) {
  const files = ['kw', 'qw', 'rw', 'bw', 'nw', 'pw', 'kb', 'qb', 'rb', 'bb', 'nb', 'pb']
  return Promise.all(files.map((name) => fetch(`https://sharechess.github.io/pieces/${setName}/${name}.svg`).then((response) => {
    if (!response.ok) throw new Error(name)
    return response.text()
  }))).then((svgs) => {
    const symbols = svgs.map((svg, index) => {
      const name = files[index]
      const id = name[1] + name[0]
      const tag = svg.match(/<svg\b([^>]*)>/)
      const attrs = tag ? tag[1] : ''
      const viewBox = (attrs.match(/viewBox="([^"]+)"/) || [])[1]
      const width = Number((attrs.match(/\bwidth="([\d.]+)/) || [])[1]) || 180
      const height = Number((attrs.match(/\bheight="([\d.]+)/) || [])[1]) || width
      const box = (viewBox || `0 0 ${width} ${height}`).split(/\s+/).map(Number)
      const size = box[2] || width
      const inner = svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
      return `<g id="${id}" transform="scale(${40 / size})">${inner}</g>`
    })
    return `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>`
  })
}

function fillStyleSelect (selectEl, files, selected) {
  selectEl.innerHTML = ''
  files.forEach((fileName) => {
    const option = document.createElement('option')
    option.value = fileName
    option.textContent = styleLabel(fileName)
    selectEl.appendChild(option)
  })
  selectEl.value = files.includes(selected) ? selected : files[0]
}

function ShareChessStyles (store) {
  this.store = store
  this.boardSelect = assert(document.getElementById('boardStyle'))
  this.pieceSelect = assert(document.getElementById('pieceStyle'))
  this.pieceTimer = null
}
ShareChessStyles.prototype.initialize = function (preference) {
  const board = preference.boardStyle || DEFAULT_BOARD_STYLE
  const pieces = (preference.pieceStyle || DEFAULT_PIECE_STYLE).replace(/\.user\.css$/, '')
  fillStyleSelect(this.boardSelect, SHARECHESS_BOARDS, board)
  fillStyleSelect(this.pieceSelect, SHARECHESS_PIECE_SETS, pieces)
  this.boardSelect.onchange = () => this.change('boards', this.boardSelect.value, { boardStyle: this.boardSelect.value })
  this.pieceSelect.onchange = () => this.change('pieces', this.pieceSelect.value, { pieceStyle: this.pieceSelect.value })
  return Promise.all([
    this.load('boards', this.boardSelect.value),
    this.load('pieces', this.pieceSelect.value)
  ])
}
ShareChessStyles.prototype.change = function (kind, fileName, preference) {
  this.store.setPreference(preference)
  this.load(kind, fileName).catch((error) => showStatus('Could not load style. ' + error.message))
}
ShareChessStyles.prototype.load = function (kind, fileName) {
  if (kind === 'pieces') return this.loadPieces(fileName)
  return fetch(`https://sharechess.github.io/stylus/${kind}/${fileName}`)
    .then((response) => {
      if (!response.ok) throw new Error(fileName)
      return response.text()
    })
    .then((css) => this.applyBoardStyle(css))
}
ShareChessStyles.prototype.loadPieces = function (setName) {
  return buildShareChessSprite(setName).then((svgText) => installShareChessSprite(svgText))
}
ShareChessStyles.prototype.applyBoardStyle = function (css) {
  const variables = css.match(/:root\s*\{[^}]*\}/)
  let style = document.getElementById('sharechess-boards')
  if (!style) {
    style = document.createElement('style')
    style.id = 'sharechess-boards'
    document.head.appendChild(style)
  }
  style.textContent = variables ? variables[0] : ''
}

function ModeManager () {
  this.factories = new Map()
  this.modes = new Map()
  this.selectedModeType = null
}
ModeManager.prototype.registerMode = function (modeType, factory) {
  if (this.factories.has(modeType)) {
    throw new Error('Mode type registered twice!')
  }
  this.factories.set(modeType, factory)
  return this
}
ModeManager.prototype.selectModeType = function (modeType) {
  if (modeType === this.selectedModeType) return
  const newMode = this.mode(modeType)
  const previous = this.selectedModeType ? this.mode(this.selectedModeType) : null
  newMode.preEnter()
  if (previous) previous.exit()
  newMode.postEnter()
  this.selectedModeType = modeType
}
ModeManager.prototype.getSelectedMode = function () {
  if (!this.selectedModeType) {
    throw new Error('No mode selected yet.')
  }
  return this.mode(this.selectedModeType)
}
ModeManager.prototype.mode = function (modeType) {
  if (!this.modes.has(modeType)) {
    const factory = this.factories.get(modeType)
    if (!factory) {
      throw new Error('Unregistered mode type: ' + modeType)
    }
    this.modes.set(modeType, factory())
  }
  return this.modes.get(modeType)
}

function SoundPlayer () {}
SoundPlayer.prototype.playMove = function () {
  this.play('move', 0.4)
}
SoundPlayer.prototype.playCapture = function () {
  this.play('capture', 0.4)
}
SoundPlayer.prototype.playWrongMove = function () {
  this.play('wrongmove', 1)
}
SoundPlayer.prototype.playFinishLine = function () {
  this.play('finishline', 1)
}
SoundPlayer.prototype.play = function (soundName, volume) {
  const audio = new Audio(`ogg/${soundName}.ogg`)
  audio.volume = volume
  audio.play().catch(() => { })
}

function PickerModel () {
  this.metadataList = []
  this.selectedIndex = -1
  this.selectedMetadata = null
}
PickerModel.prototype.isEmpty = function () {
  return !this.metadataList.length
}
PickerModel.prototype.setMetadataList = function (metadataList, selectedMetadataId) {
  this.metadataList = metadataList
  this.selectMetadataId(selectedMetadataId)
}
PickerModel.prototype.selectMetadataId = function (metadataId) {
  if (metadataId) {
    const metadataIndex = this.metadataList.findIndex(m => m.id === metadataId)
    if (metadataIndex >= 0) {
      this.selectedIndex = metadataIndex
      this.selectedMetadata = this.metadataList[metadataIndex]
      return
    }
  }
  this.selectedIndex = 0
  this.selectedMetadata = this.metadataList[0]
}

function Main () {}

Main.run = function () {
  const store = new LocalRepertoireStore(window.localStorage)
  const modeManager = new ModeManager()
  const pickerController = new PickerController(store, modeManager)
  const soundPlayer = new SoundPlayer()
  const styles = new ShareChessStyles(store)
  const pickerModel = new PickerModel()
  const pickerView = new PickerView(pickerModel, pickerController, assert(document.getElementById('picker')), assert(document.getElementById('addMetadata')))
  pickerController.initialize(pickerModel, pickerView)
  document.getElementById('studyButton').onclick = () => modeManager.selectModeType(ModeType.STUDY)
  document.getElementById('buildButton').onclick = () => modeManager.selectModeType(ModeType.BUILD)
  document.getElementById('evaluateButton').onclick = () => modeManager.selectModeType(ModeType.EVALUATE)
  modeManager
    .registerMode(ModeType.STUDY, () => new StudyMode(store, pickerController, modeManager, soundPlayer))
    .registerMode(ModeType.BUILD, () => new BuildMode(store, pickerController, modeManager, soundPlayer))
    .registerMode(ModeType.EVALUATE, () => new EvaluateMode(store, pickerController, modeManager))
  styles.initialize(store.getPreference())
  modeManager.selectModeType(ModeType.BUILD)
  document.body.onkeydown = (e) => modeManager.getSelectedMode().onKeyDown(e)
}

window.onload = function () {
  Main.run()
}

// =============================================================================
// Phase 0 — Migration scaffolding (pure functional style)
// Old localStorage path remains the only one used by the running app.
// =============================================================================

const ZEITNOT_VERSION_KEY = 'zeitnot-version'
const ZEITNOT_PHASE0_VERSION = '0'

function getZeitnotVersion (storage) {
  return storage.getItem(ZEITNOT_VERSION_KEY)
}

function setZeitnotVersion (storage, version) {
  storage.setItem(ZEITNOT_VERSION_KEY, version)
}

function isPhase0OrNewer (storage) {
  const v = getZeitnotVersion(storage)
  return v !== null && v >= ZEITNOT_PHASE0_VERSION
}

// Position-only FEN: piece placement + active color + castling + en-passant.
// Halfmove clock and fullmove number are stripped.
// Position-only FEN that includes the en-passant square only when the capture is legal.
// Relies on chess.js, which (since the fix for #252) only emits the square when legal.
// Clocks are always stripped.
function normalizePositionFen (fen) {
  if (!fen || typeof fen !== 'string') return ''
  try {
    const chess = new Chess()
    chess.load(fen)
    const canonical = chess.fen()
    const parts = canonical.trim().split(/\s+/)
    return parts.slice(0, 4).join(' ')
  } catch (e) {
    // Fall back to string slicing if the FEN cannot be loaded
    const parts = fen.trim().split(/\s+/)
    if (parts.length < 4) return fen
    return parts.slice(0, 4).join(' ')
  }
}

// Deterministic edge id
function makeMoveId (fromFen, toFen, promotion) {
  return `${fromFen}|${toFen}|${promotion || ''}`
}

// Prototype-style constructors for the new data shapes
function Position (fen) {
  const normalized = normalizePositionFen(fen)
  const parts = normalized.split(' ')
  this.fen = normalized
  this.piecePlacement = parts[0] || ''
  this.turn = parts[1] || 'w'
  this.castling = parts[2] || '-'
  this.enPassant = parts[3] || '-'
}

function Move (fromFen, toFen, san, uci, promotion) {
  this.fromFen = normalizePositionFen(fromFen)
  this.toFen = normalizePositionFen(toFen)
  this.san = san || ''
  this.uci = uci || ''
  this.promotion = promotion || null
  this.id = makeMoveId(this.fromFen, this.toFen, this.promotion)
  this.comments = []
}

function Repertoire (id, name, color, rootFen) {
  this.id = id
  this.name = name || ''
  this.color = color === 'b' ? 'b' : 'w'
  this.rootFen = normalizePositionFen(rootFen)
  this.citations = []
  this.edges = []
  this.commentOverrides = {}
  this.createdAt = Date.now()
  this.updatedAt = Date.now()
}

function Statistic (repertoireId, moveId) {
  this.id = repertoireId + '|' + moveId
  this.repertoireId = repertoireId
  this.moveId = moveId
  this.right = 0
  this.wrong = 0
  this.finishLine = 0
  this.lastReviewedAt = null
  this.lastWrongAt = null
  this.consecutiveCorrect = 0
  this.ease = 2.5
  this.intervalDays = 0
  this.nextDueAt = Date.now()
  this.recentWrongCount = 0
  this.totalAttempts = 0
  this.updatedAt = Date.now()
}

// IndexedDB open helper — creates empty stores, does not migrate or read yet
const IDB_NAME = 'zeitnot'
const IDB_VERSION = 1

function openZeitnotDb () {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('positions')) {
        db.createObjectStore('positions', { keyPath: 'fen' })
      }
      if (!db.objectStoreNames.contains('moves')) {
        const moves = db.createObjectStore('moves', { keyPath: 'id' })
        moves.createIndex('fromFen', 'fromFen', { unique: false })
        moves.createIndex('toFen', 'toFen', { unique: false })
      }
      if (!db.objectStoreNames.contains('repertoires')) {
        const repertoires = db.createObjectStore('repertoires', { keyPath: 'id' })
        repertoires.createIndex('name', 'name', { unique: false })
        repertoires.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains('statistics')) {
        const statistics = db.createObjectStore('statistics', { keyPath: 'id' })
        statistics.createIndex('repertoireId', 'repertoireId', { unique: false })
        statistics.createIndex('moveId', 'moveId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Minimal self-check for the pure FEN normalizer (runs only when ?phase0test is present)
function runPhase0SelfCheck () {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  const expected = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
  const got = normalizePositionFen(start)
  if (got !== expected) {
    console.error('Phase 0 FEN normalizer failed:', got, '!==', expected)
    return false
  }
  const withEp = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
  const expectedEp = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3'
  if (normalizePositionFen(withEp) !== expectedEp) {
    console.error('Phase 0 en-passant preservation failed')
    return false
  }
  console.log('Phase 0 self-check passed')
  return true
}

// Initialize Phase 0 scaffolding on load (does not alter existing app behavior)
function initPhase0 () {
  try {
    if (!getZeitnotVersion(window.localStorage)) {
      setZeitnotVersion(window.localStorage, ZEITNOT_PHASE0_VERSION)
    }
    // Open DB in background so the schema exists; ignore result
    openZeitnotDb().catch(() => {})
    wireShadowExportButton()
    if (typeof location !== 'undefined' && location.search.includes('phase0test')) {
      runPhase0SelfCheck()
    }
  } catch (e) {
    // Never break the existing app
  }
}


// =============================================================================
// Phase 1 — Dual-write shadow store (IndexedDB)
// Old path remains the source of truth for the UI.
// =============================================================================

function shadowWriteAfterAdd (treeModel, parentPgn, childFen) {
  // Reconstruct the move that was just added from the current chess state
  const history = treeModel.chess.history({ verbose: true })
  if (!history.length) return
  const last = history[history.length - 1]
  const fromFen = normalizePositionFen(treeModel.chess.fen()) // wait, after the move the fen is the child
  // Better: load parent and get from-fen
  // For simplicity we use the child fen and the last move info
  const move = new Move(
    last.from ? /* we need fromFen */ START_FEN : START_FEN, // placeholder, fix below
    childFen,
    last.san,
    last.from + last.to + (last.promotion || ''),
    last.promotion || null
  )
  // We'll do a full walk instead for correctness on add; for Phase 1 a full shadow of current tree is fine and simpler
  shadowWriteCurrentTree(treeModel)
}

function shadowWriteRepertoire (treeModel, oldRepertoire) {
  shadowWriteCurrentTree(treeModel, oldRepertoire)
}

function shadowWriteCurrentTree (treeModel, oldRepertoire) {
  openZeitnotDb().then(db => {
    const tx = db.transaction(['positions', 'moves', 'repertoires'], 'readwrite')
    const positions = tx.objectStore('positions')
    const moves = tx.objectStore('moves')
    const repertoires = tx.objectStore('repertoires')

    const repertoireId = (oldRepertoire && oldRepertoire.id) || 'current-' + Date.now()
    const rep = new Repertoire(
      repertoireId,
      treeModel.repertoireName || (oldRepertoire && oldRepertoire.name) || 'Unnamed',
      treeModel.repertoireColor || 'w',
      START_FEN
    )

    // Walk the tree and collect
    const visited = new Set()
    function walk (node) {
      if (!node || visited.has(node.pgn)) return
      visited.add(node.pgn)
      const fen = normalizePositionFen(node.fen || START_FEN)
      const pos = new Position(fen)
      positions.put(pos)
      if (!rep.citations.includes(fen)) rep.citations.push(fen)

      node.children.forEach(child => {
        const childFen = normalizePositionFen(child.fen)
        const uci = (child.lastMove && child.lastMove.fromSquare && child.lastMove.toSquare)
          ? child.lastMove.fromSquare + child.lastMove.toSquare + (child.lastMove.promotion || '')
          : ''
        const m = new Move(fen, childFen, child.lastMoveString || '', uci, null)
        moves.put(m)
        if (!rep.edges.includes(m.id)) rep.edges.push(m.id)
        walk(child)
      })
    }
    if (treeModel.rootNode) walk(treeModel.rootNode)

    repertoires.put(rep)
    tx.oncomplete = () => db.close()
    tx.onerror = () => db.close()
  }).catch(() => {})
}

// Manual export of the shadow store for debugging
function exportShadowJson () {
  openZeitnotDb().then(db => {
    const tx = db.transaction(['positions', 'moves', 'repertoires', 'statistics'], 'readonly')
    const result = { version: 1, positions: [], moves: [], repertoires: [], statistics: [] }
    const stores = ['positions', 'moves', 'repertoires', 'statistics']
    let pending = stores.length
    stores.forEach(name => {
      const req = tx.objectStore(name).getAll()
      req.onsuccess = () => {
        result[name] = req.result
        pending--
        if (pending === 0) {
          const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'zeitnot-shadow.json'
          a.click()
          URL.revokeObjectURL(url)
          db.close()
        }
      }
    })
  }).catch(err => console.error('Shadow export failed', err))
}

// Wire the export button if present
function wireShadowExportButton () {
  const btn = document.getElementById('shadowExportButton')
  if (btn) btn.onclick = exportShadowJson
}

// Hook into existing startup without changing Main.run signature
const originalOnLoad = window.onload
window.onload = function () {
  initPhase0()
  if (typeof originalOnLoad === 'function') {
    originalOnLoad()
  }
}
