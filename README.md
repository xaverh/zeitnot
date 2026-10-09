# Zeitnot — reimplementation

Pure functional core for shared position database + repertoire graphs.

## Steps completed

1. **Pure domain model** (`src/model/`)
   - `fen.js` — position-only FEN identity (castling + en passant kept)
   - `position.js`, `move.js` — Positions and Moves (UCI + cached SAN, promotion distinct)
   - `repertoire.js` — citations + edges + comment overrides (pure functions)
   - `project.js` — tree projection with transposition badges that jump; stays inside repertoire
   - `comments.js` — shared base + repertoire overrides
   - `statistics.js` — SM-2 spaced repetition attached to (repertoire, move)

2. **Invariants tested** (`tests/model.test.js`) — run with `node tests/model.test.js`

3. **IndexedDB + JSON** (`src/store/idb.js`, `src/store/json.js`)
   - Stores: positions, moves, repertoires, statistics
   - Full export/import and per-repertoire export

4. **Wiring skeleton** (`src/app.js`)
   - Demonstrates creating a repertoire, adding a move, SM-2 review, projection, and export
   - Full original UI (boards, modes, tree rendering) can now be adapted to call these pure functions

## Design constraints honored

- Positions shared; deleting from a repertoire only removes citations
- Tree projection never leaves the repertoire
- Study/Build stay inside repertoire edges
- Statistics on the outgoing move, SM-2 for prioritization
- Functional style; prototype only where DOM objects are unavoidable
- JSON exportable

## Next

Adapt the original `TreeView`, `StudyMode`, and `BuildMode` to consume `projectTree` and `nextMovesInRepertoire` instead of the old `TreeModel`. Migration from old localStorage trees can walk the previous structure and emit Positions + Moves + citations.
