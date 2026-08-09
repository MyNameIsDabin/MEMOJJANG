/** 화면과 노트를 정리하는 동작들 — 어디를 보여줄지, 노트를 어떻게 늘어놓을지. */
import { MAX_ZOOM, MIN_ZOOM } from '../types'
import { clamp, useBoard } from '../store/boardStore'
import { useUi } from '../store/uiStore'
import { GRID_SIZE } from '../store/settingsStore'
import { notify } from '../ui/toast'

/** 위쪽 제목·도구 줄과 아래쪽 상태 줄에 가리지 않도록 띄운다. */
const PAD = { top: 84, right: 40, bottom: 60, left: 40 }

interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

function boundsOf(ids: string[]): Bounds | null {
  const { notes } = useBoard.getState()
  let bounds: Bounds | null = null
  for (const id of ids) {
    const n = notes[id]
    if (!n) continue
    bounds = bounds
      ? {
          left: Math.min(bounds.left, n.x),
          top: Math.min(bounds.top, n.y),
          right: Math.max(bounds.right, n.x + n.w),
          bottom: Math.max(bounds.bottom, n.y + n.h),
        }
      : { left: n.x, top: n.y, right: n.x + n.w, bottom: n.y + n.h }
  }
  return bounds
}

/** 노트 하나를 화면 한가운데로 데려온다. 확대율은 건드리지 않는다.
 *
 *  노트를 화면 가득 펼쳐 놓은 상태였다면 그 자리에 이 노트를 대신 올린다.
 *  찾다가 고른 노트가 캔버스 뒤편에서만 조용히 가운데로 오면, 펼쳐 둔 화면만
 *  들여다보는 사람에게는 아무 일도 안 일어난 것처럼 보인다. */
export function focusNote(id: string): void {
  const { notes, setViewport, select, raise } = useBoard.getState()
  const note = notes[id]
  if (!note) return

  const centerX = note.x + note.w / 2
  const centerY = note.y + note.h / 2
  setViewport((vp) => ({
    ...vp,
    x: window.innerWidth / 2 - centerX * vp.zoom,
    y: window.innerHeight / 2 - centerY * vp.zoom,
  }))
  raise(id)
  select([id])
  useUi.getState().followFullscreen(id)
}

/** 주어진 노트들이 모두 보이도록 확대율과 위치를 맞춘다. 비우면 전체. */
export function zoomToFit(ids?: string[]): void {
  const { noteIds, setViewport } = useBoard.getState()
  const targets = ids?.length ? ids : noteIds
  const bounds = boundsOf(targets)
  if (!bounds) {
    notify('맞출 노트가 없습니다.')
    return
  }

  const viewW = window.innerWidth - PAD.left - PAD.right
  const viewH = window.innerHeight - PAD.top - PAD.bottom
  const contentW = Math.max(1, bounds.right - bounds.left)
  const contentH = Math.max(1, bounds.bottom - bounds.top)

  // 한 장뿐일 때 확대율이 튀지 않도록 100% 를 넘기지 않는다.
  const zoom = clamp(Math.min(viewW / contentW, viewH / contentH, 1), MIN_ZOOM, MAX_ZOOM)
  const centerX = (bounds.left + bounds.right) / 2
  const centerY = (bounds.top + bounds.bottom) / 2

  setViewport({
    zoom,
    x: PAD.left + viewW / 2 - centerX * zoom,
    y: PAD.top + viewH / 2 - centerY * zoom,
  })
}

/** 노트를 격자에 맞춰 줄줄이 늘어놓는다. 겹쳐서 엉킨 보드를 되살릴 때 쓴다.
 *  높이가 제각각이라 줄 단위로 가장 높은 노트에 맞춰 다음 줄을 내린다. */
export function arrangeGrid(ids?: string[]): void {
  const { noteIds, notes, commit, patchNote } = useBoard.getState()
  const targets = (ids?.length ? ids : noteIds).filter((id) => notes[id])
  if (targets.length < 2) {
    notify('정리할 노트가 2장 이상 필요합니다.')
    return
  }

  const bounds = boundsOf(targets)
  if (!bounds) return

  // 지금 보이는 화면 너비만큼을 한 줄로 삼는다. 화면 밖까지 늘어놓으면 정리가 아니다.
  const { zoom } = useBoard.getState().viewport
  const rowWidth = Math.max(400, (window.innerWidth - PAD.left - PAD.right) / zoom)

  // 지금 놓인 자리 순서(위에서 아래, 왼쪽에서 오른쪽)를 지켜야 사용자가 흐름을 잃지 않는다.
  const ordered = [...targets].sort((a, b) => {
    const na = notes[a]
    const nb = notes[b]
    // 같은 줄로 볼 만큼 가까우면 가로 위치로 가른다.
    if (Math.abs(na.y - nb.y) > GRID_SIZE * 2) return na.y - nb.y
    return na.x - nb.x
  })

  commit()

  let x = bounds.left
  let y = bounds.top
  let rowHeight = 0

  for (const id of ordered) {
    const note = notes[id]
    if (x > bounds.left && x + note.w > bounds.left + rowWidth) {
      x = bounds.left
      y += rowHeight + GRID_SIZE
      rowHeight = 0
    }
    patchNote(id, {
      x: Math.round(x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(y / GRID_SIZE) * GRID_SIZE,
    })
    x += note.w + GRID_SIZE
    rowHeight = Math.max(rowHeight, note.h)
  }
}
