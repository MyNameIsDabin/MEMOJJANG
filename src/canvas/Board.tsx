/** 무한 캔버스. 노트는 월드 좌표에 절대배치되고, 바깥 래퍼 하나에만
 *  transform 을 걸어 팬/줌을 처리한다. 노트 수가 늘어도 변환 비용은 그대로다. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { toWorld, useBoard } from '../store/boardStore'
import { GRID_SIZE, useSettings } from '../store/settingsStore'
import { NoteShell } from '../notes/NoteShell'
import { BoardMenu, type MenuAnchor } from '../ui/BoardMenu'
import { StickerPicker } from '../ui/StickerPicker'
import { StickerLayer } from './StickerLayer'
import { StickerHandles } from './StickerHandles'
import { StickerLinks } from './StickerLinks'
import { useUi } from '../store/uiStore'
import { handleDrop, shouldHandleDrop } from '../actions/drop'
import { lastPointer } from './pointer'
import './board.css'

/** 커서 밑에 "그 방향으로 더 굴릴 수 있는" 칸이 있는가.
 *
 *  끝까지 굴렸으면 그때부터는 캔버스를 민다. 브라우저에서 겹친 스크롤 칸이 하는 것과 같다. */
function canScrollHere(
  target: EventTarget | null,
  axis: 'x' | 'y',
  delta: number,
  boundary: HTMLElement,
): boolean {
  let el = target as HTMLElement | null
  while (el && el !== boundary) {
    const style = getComputedStyle(el)
    const overflow = axis === 'y' ? style.overflowY : style.overflowX
    // 입력칸은 브라우저 기본값이 판마다 달라, 우리 CSS 에서 overflow 를 못 박아 두었다.
    if (/(auto|scroll|overlay)/.test(overflow)) {
      const size = axis === 'y' ? el.clientHeight : el.clientWidth
      const content = axis === 'y' ? el.scrollHeight : el.scrollWidth
      const at = axis === 'y' ? el.scrollTop : el.scrollLeft
      // 1px 은 소수점 반올림으로 생기는 여유. 이걸 안 두면 끝에서 덜덜거린다.
      if (content - size > 1) {
        if (delta < 0 && at > 1) return true
        if (delta > 0 && at + size < content - 1) return true
      }
    }
    el = el.parentElement
  }
  return false
}

type Drag =
  | { mode: 'pan'; startX: number; startY: number; originX: number; originY: number; moved: boolean }
  | { mode: 'marquee'; startX: number; startY: number; additive: boolean }

interface Marquee {
  left: number
  top: number
  width: number
  height: number
}

export function Board() {
  const boardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)

  const viewport = useBoard((s) => s.viewport)
  const noteIds = useBoard(useShallow((s) => s.noteIds))
  const showGrid = useSettings((s) => s.showGrid)

  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const [dropping, setDropping] = useState(false)
  /** 꾸미기 모드에서 우클릭한 자리 — 스티커 서랍이 여기에 뜬다. */
  const [drawer, setDrawer] = useState<{ screenX: number; screenY: number; world: { x: number; y: number } } | null>(
    null,
  )

  const decorating = useUi((s) => s.decorating)
  const activeStickerId = useUi((s) => s.activeStickerId)

  /* 끌어다 놓기.
     dragleave 는 자식 위로 옮겨갈 때도 터지므로, 들어오고 나간 횟수를 세어
     정말로 바깥으로 나갔을 때만 표시를 거둔다. */
  const dragDepth = useRef(0)

  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!shouldHandleDrop(e.target)) return
    e.preventDefault()
    dragDepth.current += 1
    setDropping(true)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!shouldHandleDrop(e.target)) return
    // 막지 않으면 브라우저가 "여기엔 못 놓는다" 며 drop 을 아예 안 준다.
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDragLeave = useCallback(() => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDropping(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    dragDepth.current = 0
    setDropping(false)
    if (!shouldHandleDrop(e.target)) return
    e.preventDefault()
    const world = toWorld(useBoard.getState().viewport, e.clientX, e.clientY)
    void handleDrop(e.dataTransfer, world)
  }, [])

  // 휠은 preventDefault 를 해야 창 전체가 스크롤되지 않는데, React 의 합성 이벤트는
  // passive 로 붙어 막을 수 없다. 그래서 네이티브로 직접 등록한다.
  useEffect(() => {
    const el = boardRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      /* 확대/축소는 Ctrl 을 누른 채로만 한다.
         그냥 휠에 배율을 걸어 두면, 긴 메모를 끝까지 굴린 순간 배율이 튀어 버린다.
         굴리던 손 그대로 화면이 확 커지는 건 손 쓸 새도 없이 벌어져서 되돌리기도 번거롭다.
         노트 안을 굴리는 것보다도 먼저 본다 — 여기서 막지 않으면 웹뷰가 창 전체를 확대한다. */
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        // deltaY 는 장치마다 단위가 달라서 방향만 취하고 배율은 우리가 정한다.
        useBoard.getState().zoomAt(e.clientX, e.clientY, Math.exp(-Math.sign(e.deltaY) * 0.12))
        return
      }

      // 내용이 넘쳐 스크롤이 생긴 노트 위에서는 그 안을 굴린다.
      // 여기서 preventDefault 를 하지 않고 빠지면 브라우저가 알아서 그 칸을 굴린다
      // (Shift 를 누른 채면 브라우저가 좌우로 굴려 준다).
      if (canScrollHere(e.target, e.shiftKey ? 'x' : 'y', e.deltaY, el)) return

      /* 그 밖의 휠은 아무 일도 하지 않는다.
         화면을 미는 데까지 휠을 쓰면, 노트를 끝까지 굴린 순간 그 아래 캔버스가 딸려 움직인다.
         읽던 자리를 잃는 건 배율이 튀는 것과 다를 바 없어서, 화면 옮기기는 손으로 끄는 쪽에만 맡긴다
         — 휠 클릭 드래그, 또는 빈 곳 드래그. */
      e.preventDefault()
    }

    // 가운데 버튼을 누르면 Chromium 이 자동 스크롤 모드로 들어가면서 뒤따르는 마우스 이동을
    // 통째로 삼킨다. pointerdown 에서 preventDefault 해도 소용없고, mousedown 의 기본 동작을
    // 막아야 한다. 캡처 단계에서 잡아야 스크롤 가능한 자식(메모 입력칸 등)보다 먼저 처리된다.
    const onMouseDownCapture = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('mousedown', onMouseDownCapture, { capture: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('mousedown', onMouseDownCapture, { capture: true })
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // 가운데 버튼(휠 클릭)은 어디서 눌렸든 화면을 옮긴다.
    // 노트 위에 커서가 있어도 마찬가지여야 한다 — 화면을 옮기려는 뜻이 분명하고,
    // 노트를 피해 빈 곳을 찾아 눌러야 한다면 번거롭다.
    const middle = e.button === 1
    if (middle) {
      // 누르고 있는 동안 Windows 의 자동 스크롤 표식이 뜨는 것을 막는다.
      e.preventDefault()
    } else {
      // 격자는 pointer-events:none 이라 빈 곳을 누르면 target 이 곧 .board 다.
      // 노트 위에서 시작한 왼쪽 드래그는 노트가 알아서 처리하므로 여기서 걸러낸다.
      if (e.target !== e.currentTarget) return
      if (e.button !== 0) return
    }

    setMenu(null)
    // 스티커 바깥을 누르면 손잡이를 거둔다 — 그것으로 배치가 끝난다.
    if (useUi.getState().activeStickerId) useUi.getState().pickSticker(null)

    const { viewport: vp, clearSelection } = useBoard.getState()

    if (e.button === 0 && e.shiftKey) {
      dragRef.current = { mode: 'marquee', startX: e.clientX, startY: e.clientY, additive: e.ctrlKey }
      setMarquee({ left: e.clientX, top: e.clientY, width: 0, height: 0 })
    } else {
      dragRef.current = {
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        originX: vp.x,
        originY: vp.y,
        moved: false,
      }
      // 휠 클릭은 화면만 옮기는 동작이라 선택을 건드리지 않는다.
      if (!e.shiftKey && !middle) clearSelection()
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    lastPointer.x = e.clientX
    lastPointer.y = e.clientY
    lastPointer.inside = true

    const drag = dragRef.current
    if (!drag) return

    // 창 밖에서 버튼을 뗀 경우, 그 사건을 놓쳤더라도 여기서 알아채고 손을 뗀다.
    if (e.buttons === 0) {
      dragRef.current = null
      setMarquee(null)
      return
    }

    if (drag.mode === 'pan') {
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true
      useBoard.getState().setViewport((vp) => ({ ...vp, x: drag.originX + dx, y: drag.originY + dy }))
    } else {
      setMarquee({
        left: Math.min(drag.startX, e.clientX),
        top: Math.min(drag.startY, e.clientY),
        width: Math.abs(e.clientX - drag.startX),
        height: Math.abs(e.clientY - drag.startY),
      })
    }
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)

    if (drag?.mode === 'marquee' && marquee) {
      const { notes, noteIds: ids, viewport: vp, selection, select } = useBoard.getState()
      const a = toWorld(vp, marquee.left, marquee.top)
      const b = toWorld(vp, marquee.left + marquee.width, marquee.top + marquee.height)
      const hit = ids.filter((id) => {
        const n = notes[id]
        return n && n.x < b.x && n.x + n.w > a.x && n.y < b.y && n.y + n.h > a.y
      })
      select(drag.additive ? [...new Set([...selection, ...hit])] : hit)
      setMarquee(null)
    }
  }, [marquee])

  const onContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 꾸미는 중에는 노트 위에서 눌렀더라도 스티커 서랍이 뜬다 —
      // 그 자리에 붙이려고 누르는 것이기 때문이다.
      if (decorating) {
        e.preventDefault()
        setMenu(null)
        setDrawer({
          screenX: e.clientX,
          screenY: e.clientY,
          world: toWorld(useBoard.getState().viewport, e.clientX, e.clientY),
        })
        return
      }
      if (e.target !== e.currentTarget) return
      e.preventDefault()
      setMenu({ screenX: e.clientX, screenY: e.clientY })
    },
    [decorating],
  )

  const gridStyle = showGrid
    ? {
        backgroundImage: 'radial-gradient(circle, var(--canvas-dot) 1px, transparent 1px)',
        backgroundSize: `${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }
    : undefined

  return (
    <div
      ref={boardRef}
      className={`board${decorating ? ' board--decorating' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        lastPointer.inside = false
      }}
      onContextMenu={onContextMenu}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="board__grid" style={gridStyle} />

      <div
        className="board__world"
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
        }}
      >
        <StickerLayer layer="behind" />

        {noteIds.map((id) => (
          <NoteShell key={id} id={id} />
        ))}

        <StickerLayer layer="front" />

        {decorating && (
          <div className="stickers stickers--ui">
            <StickerLinks />
            {activeStickerId && <StickerHandles id={activeStickerId} />}
          </div>
        )}
      </div>

      {marquee && (
        <div
          className="board__marquee"
          style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}
        />
      )}

      {dropping && (
        <div className="board__drop">
          <span className="board__droptag">여기에 놓으면 그림이 됩니다</span>
        </div>
      )}

      {menu && <BoardMenu anchor={menu} onClose={() => setMenu(null)} />}

      {drawer && (
        <StickerPicker
          screenX={drawer.screenX}
          screenY={drawer.screenY}
          world={drawer.world}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  )
}
