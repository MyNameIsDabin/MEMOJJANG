/** 모든 노트가 공유하는 껍데기 — 제목 표시줄, 드래그, 크기 조절, 접기, 삭제.
 *  본문만 종류별로 갈아 끼운다. */
import { useCallback, useRef } from 'react'
import { ACCENTS, MIN_NOTE_W, type Note } from '../types'
import { imageChromeHeight, useBoard } from '../store/boardStore'
import { useUi } from '../store/uiStore'
import { GRID_SIZE, useSettings } from '../store/settingsStore'
import { TodoBody } from './TodoBody'
import { MemoBody } from './MemoBody'
import { ImageBody } from './ImageBody'
import { LinkBody } from './LinkBody'
import { Icon } from '../ui/Icon'
import './note.css'

const KIND_LABEL: Record<Note['kind'], string> = {
  todo: '할 일',
  memo: '메모',
  image: '이미지',
  link: '바로가기',
}

/** 드래그로 볼지 클릭으로 볼지 가르는 문턱(화면 픽셀). */
const DRAG_SLOP = 3

interface DragState {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  /** 문턱을 넘어 실제로 드래그가 시작됐는지 */
  dragging: boolean
  /** 포인터를 붙잡았는지. 버튼 위에서 시작하면 클릭을 살리려고 잠시 미룬다. */
  captured: boolean
  ids: string[]
}

interface ResizeState {
  pointerId: number
  startX: number
  startY: number
  startW: number
  startH: number
  moved: boolean
  axis: 'se' | 'e' | 's'
}

/** `expanded` 는 캔버스를 떠나 화면 가득 펼쳐 놓은 상태다.
 *  자리와 크기를 CSS 에 넘기므로 창을 늘리면 본문도 따라 늘어난다.
 *  옮기기·크기 조절·접기는 이 상태에서 뜻이 없으니 내놓지 않는다. */
export function NoteShell({ id, expanded = false }: { id: string; expanded?: boolean }) {
  const note = useBoard((s) => s.notes[id])
  const selected = useBoard((s) => s.selection.includes(id))
  const snapToGrid = useSettings((s) => s.snapToGrid)

  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  // 제목 고치기는 F2 로도 들어오므로 상태를 노트 안에 두지 않고 밖에서 받는다.
  const editingTitle = useUi((s) => s.renamingNoteId === id)

  /* 제목 표시줄은 어느 자리를 잡아도 드래그가 되어야 한다 — 버튼 위도 마찬가지다.
     그런데 버튼 위에서 포인터를 곧바로 잡아 버리면 뒤이은 click 이 버튼이 아니라 표시줄로 가서
     버튼이 아예 눌리지 않는다. 그래서 버튼을 눌렀을 때만 잡기를 미루고,
     표시줄 빈 자리·제목을 눌렀을 때는 즉시 잡는다.

     즉시 잡는 쪽이 중요한 이유: 잡기 전에는 포인터가 표시줄 밖으로 나가는 순간 이벤트가 끊긴다.
     빠르게 끌면 창 밖에서 버튼을 떼게 되고, 그러면 pointerup 을 못 받아 드래그 상태가 남는다.
     그 뒤에 표시줄에 마우스를 얹기만 해도 노트가 따라다니게 된다. */

  const beginDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()

      const { selection, select, raise } = useBoard.getState()
      raise(id)

      let ids: string[]
      if (e.shiftKey) {
        useBoard.getState().toggleSelect(id)
        ids = useBoard.getState().selection
      } else if (selection.includes(id)) {
        ids = selection
      } else {
        select([id])
        ids = [id]
      }

      const onButton = Boolean((e.target as HTMLElement).closest('button'))
      if (!onButton) e.currentTarget.setPointerCapture(e.pointerId)

      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        dragging: false,
        captured: !onButton,
        ids,
      }
    },
    [id],
  )

  const onDragMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return

    // 어딘가에서 버튼이 떼어졌는데 그 사건을 놓친 경우. 여기서 알아채고 손을 뗀다.
    if (e.buttons === 0) {
      dragRef.current = null
      return
    }

    if (!drag.dragging) {
      const far =
        Math.abs(e.clientX - drag.startX) > DRAG_SLOP || Math.abs(e.clientY - drag.startY) > DRAG_SLOP
      if (!far) return
      drag.dragging = true
      if (!drag.captured) {
        // 버튼에서 시작한 드래그도 여기서부터는 붙잡는다.
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.captured = true
      }
      // 되돌리기 지점도 이때 남긴다. 눌렀다 뗀 것만으로 스택이 차면 Ctrl+Z 가 헛돈다.
      useBoard.getState().commit()
    }

    const { zoom } = useBoard.getState().viewport
    // 화면에서 움직인 거리를 줌으로 나눠야 월드 기준 이동량이 된다.
    useBoard.getState().moveNotes(drag.ids, (e.clientX - drag.lastX) / zoom, (e.clientY - drag.lastY) / zoom)
    drag.lastX = e.clientX
    drag.lastY = e.clientY
  }, [])

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      dragRef.current = null

      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      if (!drag.dragging) return

      if (snapToGrid) {
        const { notes, patchNote } = useBoard.getState()
        for (const nid of drag.ids) {
          const n = notes[nid]
          if (!n) continue
          patchNote(nid, {
            x: Math.round(n.x / GRID_SIZE) * GRID_SIZE,
            y: Math.round(n.y / GRID_SIZE) * GRID_SIZE,
          })
        }
      }
    },
    [snapToGrid],
  )

  const beginResize = useCallback(
    (axis: ResizeState['axis']) => (e: React.PointerEvent) => {
      if (e.button !== 0 || !note) return
      e.stopPropagation()
      resizeRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startW: note.w,
        startH: note.h,
        moved: false,
        axis,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [note],
  )

  const onResizeMove = useCallback(
    (e: React.PointerEvent) => {
      const rs = resizeRef.current
      if (!rs || rs.pointerId !== e.pointerId) return
      // 창 밖에서 버튼을 뗀 경우를 놓치지 않는다.
      if (e.buttons === 0) {
        resizeRef.current = null
        return
      }
      if (!rs.moved) {
        if (Math.abs(e.clientX - rs.startX) <= DRAG_SLOP && Math.abs(e.clientY - rs.startY) <= DRAG_SLOP) return
        rs.moved = true
        useBoard.getState().commit()
      }
      const { zoom } = useBoard.getState().viewport
      const dx = (e.clientX - rs.startX) / zoom
      const dy = (e.clientY - rs.startY) / zoom

      let width = rs.axis === 's' ? rs.startW : rs.startW + dx
      let height = rs.axis === 'e' ? rs.startH : rs.startH + dy

      // 그림은 원본 비율을 벗어나지 않게 붙잡는다.
      // 그래야 늘렸을 때 남거나 잘리는 자리 없이 액자에 딱 맞는다.
      if (note?.kind === 'image' && note.naturalW && note.naturalH) {
        const ratio = note.naturalH / note.naturalW
        const chrome = imageChromeHeight()
        if (rs.axis === 's') width = Math.max(MIN_NOTE_W, (height - chrome) / ratio)
        height = width * ratio + chrome
      }

      useBoard.getState().resizeNote(id, width, height)
    },
    [id, note],
  )

  const endResize = useCallback((e: React.PointerEvent) => {
    if (resizeRef.current?.pointerId !== e.pointerId) return
    resizeRef.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  if (!note) return null

  const cycleAccent = () => {
    const next = ACCENTS[(ACCENTS.indexOf(note.accent) + 1) % ACCENTS.length]
    useBoard.getState().patchNote(id, { accent: next })
  }

  const toggleCollapsed = () => useBoard.getState().patchNote(id, { collapsed: !note.collapsed })

  // 펼쳐 놓았을 때는 접힘도 무시한다 — 화면을 다 내주고 제목만 남는 건 앞뒤가 안 맞는다.
  const collapsed = note.collapsed && !expanded

  return (
    <div
      className={[
        'note',
        `note--${note.kind}`,
        selected && !expanded ? 'note--selected' : '',
        collapsed ? 'note--collapsed' : '',
        expanded ? 'note--expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        expanded
          ? { ['--note-accent' as string]: `var(--accent-${note.accent})` }
          : {
              left: note.x,
              top: note.y,
              width: note.w,
              height: collapsed ? undefined : note.h,
              zIndex: note.z,
              // 제목 표시줄 색. 노트마다 다르게 줄 수 있어 한눈에 구분된다.
              ['--note-accent' as string]: `var(--accent-${note.accent})`,
            }
      }
      // 제목 표시줄은 beginDrag 가 전파를 끊으므로 여기까지 오지 않는다.
      // 즉 이 핸들러는 본문을 눌렀을 때만 돈다.
      onPointerDown={(e) => {
        // 휠 클릭은 화면을 옮기려는 것이므로 캔버스에 넘긴다.
        if (e.button !== 0 || expanded) return
        const board = useBoard.getState()
        board.raise(id)
        if (!e.shiftKey && !board.selection.includes(id)) board.select([id])
      }}
    >
      <div
        className="note__bar"
        onPointerDown={expanded ? undefined : beginDrag}
        onPointerMove={expanded ? undefined : onDragMove}
        onPointerUp={expanded ? undefined : endDrag}
        onPointerCancel={expanded ? undefined : endDrag}
        onDoubleClick={expanded ? undefined : toggleCollapsed}
      >
        <button type="button" className="note__swatch" title="색 바꾸기" onClick={cycleAccent} />

        {editingTitle ? (
          <input
            className="note__title note__title--edit"
            defaultValue={note.title}
            autoFocus
            onPointerDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              useBoard.getState().patchNote(id, { title: e.currentTarget.value.trim() || KIND_LABEL[note.kind] })
              useUi.getState().stopRenaming()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                // 원래 이름을 되돌려 놓고 나간다. 빠져나갈 때 그 값이 그대로 저장된다.
                e.currentTarget.value = note.title
                e.currentTarget.blur()
              }
            }}
          />
        ) : (
          <span className="note__title">{note.title}</span>
        )}

        {!editingTitle && (
          <button
            type="button"
            className="note__ctl"
            title="이름 바꾸기 (F2)"
            onClick={() => useUi.getState().startRenaming(id)}
          >
            <Icon name="pencil" />
          </button>
        )}
        <button
          type="button"
          className="note__ctl"
          title={expanded ? '캔버스로 돌아가기 (Esc)' : '화면 가득 펼치기'}
          aria-pressed={expanded}
          onClick={() =>
            expanded ? useUi.getState().collapseNote() : useUi.getState().expandNote(id)
          }
        >
          <Icon name={expanded ? 'shrink' : 'expand'} />
        </button>

        {!expanded && (
          <button
            type="button"
            className="note__ctl"
            title={note.collapsed ? '펼치기' : '접기'}
            onClick={toggleCollapsed}
          >
            <Icon name={note.collapsed ? 'winMaximize' : 'collapse'} />
          </button>
        )}

        <button
          type="button"
          className="note__ctl note__ctl--close"
          title="삭제"
          onClick={() => useBoard.getState().removeNotes([id])}
        >
          <Icon name="close" />
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="note__body">
            {note.kind === 'todo' && <TodoBody note={note} />}
            {note.kind === 'memo' && <MemoBody note={note} />}
            {note.kind === 'image' && <ImageBody note={note} />}
            {note.kind === 'link' && <LinkBody note={note} />}
          </div>

          {!expanded &&
            (['e', 's', 'se'] as const).map((axis) => (
              <div
                key={axis}
                className={`note__grip note__grip--${axis}`}
                onPointerDown={beginResize(axis)}
                onPointerMove={onResizeMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
              />
            ))}
        </>
      )}
    </div>
  )
}
