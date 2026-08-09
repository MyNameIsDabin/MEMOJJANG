/** 할 일 노트. 짧은 항목을 빠르게 쳐넣는 게 목적이라
 *  Enter 로 다음 줄, 빈 줄에서 Backspace 로 지우기가 핵심 조작이다. */
import { useEffect, useRef, useState } from 'react'
import { newId, type TodoItem, type TodoNote } from '../types'
import { useBoard } from '../store/boardStore'
import { Icon } from '../ui/Icon'
import { describeDue, nextTickDelay } from './due'
import { DuePopup } from './DuePopup'

export function TodoBody({ note }: { note: TodoNote }) {
  const inputs = useRef(new Map<string, HTMLTextAreaElement>())
  const rows = useRef(new Map<string, HTMLElement>())
  /** 방금 만든 항목으로 커서를 옮기기 위한 예약. 렌더 뒤에 처리된다. */
  const focusNext = useRef<string | null>(null)

  const [dueFor, setDueFor] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = focusNext.current
    if (!id) return
    focusNext.current = null
    const el = inputs.current.get(id)
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  })

  // 남은 시간 표시를 살아 있게 한다. 마감이 코앞일 때만 초 단위로 돈다.
  useEffect(() => {
    const delay = nextTickDelay(note.items, now)
    if (delay === null) return
    const timer = setTimeout(() => setNow(Date.now()), delay)
    return () => clearTimeout(timer)
  }, [note.items, now])

  const write = (items: TodoItem[]) => useBoard.getState().patchNote(note.id, { items })

  const patchItem = (itemId: string, patch: Partial<TodoItem>) =>
    write(note.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)))

  const insertAfter = (itemId: string | null) => {
    const fresh: TodoItem = { id: newId(), text: '', done: false }
    const at = itemId ? note.items.findIndex((it) => it.id === itemId) + 1 : note.items.length
    const items = [...note.items]
    items.splice(at, 0, fresh)
    focusNext.current = fresh.id
    write(items)
  }

  const drop = (itemId: string, focusPrevious = false) => {
    const index = note.items.findIndex((it) => it.id === itemId)
    if (index < 0) return
    if (focusPrevious && index > 0) focusNext.current = note.items[index - 1].id
    write(note.items.filter((it) => it.id !== itemId))
  }

  const onKeyDown = (item: TodoItem) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      insertAfter(item.id)
    } else if (e.key === 'Backspace' && item.text === '' && note.items.length > 1) {
      e.preventDefault()
      drop(item.id, true)
    }
  }

  /* ── 순서 바꾸기 ──────────────────────────────────────────────────
     위아래로만 움직이므로, 포인터가 지금 어느 줄 위에 있는지만 알면 된다.
     끄는 동안 실제로 순서를 바꿔 두면 자리 이동이 바로 눈에 보인다. */

  const reorder = useRef<{ pointerId: number; from: number } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const rowIndexAt = (clientY: number): number => {
    for (let i = 0; i < note.items.length; i += 1) {
      const rect = rows.current.get(note.items[i].id)?.getBoundingClientRect()
      if (rect && clientY < rect.bottom) return i
    }
    return note.items.length - 1
  }

  const beginReorder = (index: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    reorder.current = { pointerId: e.pointerId, from: index }
    setDragging(note.items[index].id)
  }

  const onReorderMove = (e: React.PointerEvent) => {
    const state = reorder.current
    if (!state || state.pointerId !== e.pointerId) return
    // 창 밖에서 버튼을 뗀 경우를 놓치지 않는다.
    if (e.buttons === 0) {
      reorder.current = null
      setDragging(null)
      return
    }

    const target = rowIndexAt(e.clientY)
    if (target === state.from) return

    const items = [...note.items]
    const [moved] = items.splice(state.from, 1)
    items.splice(target, 0, moved)
    state.from = target
    write(items)
  }

  const endReorder = (e: React.PointerEvent) => {
    if (reorder.current?.pointerId !== e.pointerId) return
    reorder.current = null
    setDragging(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const done = note.items.filter((it) => it.done).length

  return (
    <div className="todo">
      <div className="todo__list">
        {note.items.map((item, index) => {
          const due = item.done ? null : describeDue(item, now)
          return (
            <div
              key={item.id}
              ref={(el) => {
                if (el) rows.current.set(item.id, el)
                else rows.current.delete(item.id)
              }}
              className={`todo__row${item.done ? ' todo__row--done' : ''}${
                dragging === item.id ? ' todo__row--dragging' : ''
              }`}
            >
              <button
                type="button"
                className="todo__grip"
                title="끌어서 순서 바꾸기"
                onPointerDown={beginReorder(index)}
                onPointerMove={onReorderMove}
                onPointerUp={endReorder}
                onPointerCancel={endReorder}
              >
                <Icon name="grip" />
              </button>

              <button
                type="button"
                className="todo__check"
                title={item.done ? '되돌리기' : '완료'}
                onClick={() => patchItem(item.id, { done: !item.done })}
              >
                {item.done ? '✔' : ''}
              </button>

              <textarea
                className="todo__text"
                rows={1}
                value={item.text}
                placeholder="할 일…"
                spellCheck={false}
                ref={(el) => {
                  if (el) inputs.current.set(item.id, el)
                  else inputs.current.delete(item.id)
                }}
                // 휠 클릭은 캔버스가 화면을 옮기는 데 써야 하므로 막지 않는다.
                onPointerDown={(e) => {
                  if (e.button === 0) e.stopPropagation()
                }}
                onChange={(e) => patchItem(item.id, { text: e.target.value })}
                onKeyDown={onKeyDown(item)}
              />

              {due && (
                <span
                  className={`duetag${due.overdue ? ' duetag--over' : ''}`}
                  title={new Date(item.due as number).toLocaleString()}
                >
                  <span className="duebar">
                    <span className="duebar__fill" style={{ width: `${Math.round(due.progress * 100)}%` }} />
                  </span>
                  {due.label}
                </span>
              )}

              <button
                type="button"
                className={`todo__act${item.due ? ' todo__act--on' : ''}`}
                title="마감 정하기"
                onClick={() => setDueFor(dueFor === item.id ? null : item.id)}
              >
                <Icon name="clock" />
              </button>
              <button
                type="button"
                className="todo__act todo__act--drop"
                title="항목 삭제"
                onClick={() => drop(item.id)}
              >
                <Icon name="close" />
              </button>

              {dueFor === item.id && (
                <DuePopup
                  item={item}
                  onApply={(at) => {
                    patchItem(item.id, { due: at, dueSetAt: Date.now() })
                    setNow(Date.now())
                    setDueFor(null)
                  }}
                  onClear={() => {
                    patchItem(item.id, { due: undefined, dueSetAt: undefined })
                    setDueFor(null)
                  }}
                  onClose={() => setDueFor(null)}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="todo__foot">
        <button type="button" className="todo__add" onClick={() => insertAfter(null)}>
          + 항목
        </button>
        <span>
          {done}/{note.items.length}
        </span>
      </div>
    </div>
  )
}
