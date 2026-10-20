/** 캔버스 탭. 탭 하나가 파일 하나다.
 *  창 제목 표시줄 안에 얹히므로 테두리 없는 요즘 스타일로 그린다. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCanvases } from '../store/canvasStore'
import { baseName } from '../platform/files'
import { confirmAsk } from './confirm'
import { Icon } from './Icon'
import { t, useT } from '../i18n'
import type { CanvasRef } from '../types'
import './tabs.css'

/** 이만큼은 움직여야 끌기로 본다. 그보다 덜 움직였으면 그냥 누른 것이다. */
const DRAG_START = 5

/** 끄는 동안 보여 줄 차례. 실제 차례는 놓을 때 한 번만 바꾼다 — 그때만 작업공간을 쓴다. */
function reorder(list: CanvasRef[], id: string, to: number): CanvasRef[] {
  const moving = list.find((c) => c.id === id)
  if (!moving) return list
  const rest = list.filter((c) => c.id !== id)
  rest.splice(to, 0, moving)
  return rest
}

export function CanvasTabs() {
  const canvases = useCanvases(useShallow((s) => s.canvases))
  const activeId = useCanvases((s) => s.activeId)
  const busy = useCanvases((s) => s.busy)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null)
  /** 끌기를 마치면 click 이 따라온다. 그건 탭을 고른 것이 아니다. */
  const draggedRef = useRef(false)
  const say = useT()

  /** 끄는 탭이 들어갈 자리. 나머지 탭 중 한가운데가 포인터보다 왼쪽에 있는 것의 수다.
   *  나머지끼리의 차례는 끄는 동안에도 변하지 않으므로, 미리보기로 자리가 바뀌어도 그대로 맞다. */
  const slotAt = (x: number, id: string): number => {
    let slot = 0
    for (const tab of stripRef.current?.querySelectorAll<HTMLElement>('[data-tab]') ?? []) {
      if (tab.dataset.tab === id) continue
      const box = tab.getBoundingClientRect()
      if (x > box.left + box.width / 2) slot += 1
    }
    return slot
  }

  const startDrag = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return
    const startX = e.clientX
    let to: number | null = null
    draggedRef.current = false

    const onMove = (ev: PointerEvent) => {
      if (to === null && Math.abs(ev.clientX - startX) < DRAG_START) return
      draggedRef.current = true
      to = slotAt(ev.clientX, id)
      setDrag({ id, to })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setDrag(null)
      if (to !== null) useCanvases.getState().moveCanvas(id, to)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const shown = drag ? reorder(canvases, drag.id, drag.to) : canvases

  return (
    <div className={`tabs${drag ? ' tabs--dragging' : ''}`}>
      <div className="tabs__strip" ref={stripRef}>
        {shown.map((canvas) => {
          const active = canvas.id === activeId
          const dragging = drag?.id === canvas.id
          return (
            <div
              key={canvas.id}
              data-tab={canvas.id}
              className={`tab${active ? ' tab--on' : ''}${dragging ? ' tab--drag' : ''}`}
              title={canvas.path}
            >
              {renamingId === canvas.id ? (
                <input
                  className="tab__rename"
                  defaultValue={canvas.name}
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => {
                    useCanvases.getState().renameCanvas(canvas.id, e.currentTarget.value)
                    setRenamingId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') {
                      // 되돌리기 — 원래 이름을 넣어 두고 빠져나간다.
                      e.currentTarget.value = canvas.name
                      e.currentTarget.blur()
                    }
                  }}
                />
              ) : (
                <>
                  <button
                    type="button"
                    className="tab__label"
                    disabled={busy}
                    onPointerDown={(e) => startDrag(e, canvas.id)}
                    onClick={() => {
                      if (draggedRef.current) {
                        draggedRef.current = false
                        return
                      }
                      void useCanvases.getState().switchTo(canvas.id)
                    }}
                    onDoubleClick={() => setRenamingId(canvas.id)}
                  >
                    {canvas.name}
                  </button>
                  <button
                    type="button"
                    className="tab__act"
                    title={say('tabs.rename')}
                    onClick={() => setRenamingId(canvas.id)}
                  >
                    <Icon name="pencil" />
                  </button>
                  <button
                    type="button"
                    className="tab__act tab__act--close"
                    title={say('tabs.close')}
                    disabled={busy}
                    onClick={() => void useCanvases.getState().closeCanvas(canvas.id)}
                  >
                    <Icon name="close" />
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      <button
        ref={addRef}
        type="button"
        className="tabs__btn"
        disabled={busy}
        aria-expanded={adding}
        title={say('tabs.add')}
        onClick={() => setAdding((v) => !v)}
      >
        <Icon name="plus" />
      </button>
      {adding && <AddMenu anchor={addRef} onClose={() => setAdding(false)} />}

      <button
        type="button"
        className="tabs__btn"
        disabled={busy}
        title={say('tabs.open')}
        onClick={() => void useCanvases.getState().openCanvas()}
      >
        <Icon name="folder" />
      </button>
    </div>
  )
}

/** 최근 기록을 지우기 전에 한 번 더 묻는다. */
async function forgetRecent(): Promise<void> {
  const ok = await confirmAsk({
    message: t('tabs.forgetAsk'),
    detail: t('tabs.forgetDetail'),
    confirmLabel: t('tabs.forgetRecent'),
    danger: true,
  })
  if (ok) useCanvases.getState().clearRecent()
}

/** 메뉴가 이만큼은 된다고 보고 자리를 잡는다. 그린 뒤에 재면 한 번 깜빡인다. */
const MENU_WIDTH = 240

/** 더하기 단추에서 내려오는 메뉴 — 새로 만들지, 폴더에서 찾을지, 최근에 열던 것에서 고를지. */
function AddMenu({
  anchor,
  onClose,
}: {
  anchor: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const say = useT()
  const recent = useCanvases(useShallow((s) => s.recent))
  const openPaths = useCanvases(useShallow((s) => s.canvases.map((c) => c.path)))
  const [spot, setSpot] = useState<{ top: number; left: number } | null>(null)

  // 메뉴는 제목 표시줄 밖으로 내려온다. 창이 좁으면 오른쪽으로 삐져나가므로 안쪽으로 당긴다.
  useLayoutEffect(() => {
    const box = anchor.current?.getBoundingClientRect()
    if (!box) return
    setSpot({
      top: box.bottom + 2,
      left: Math.max(4, Math.min(box.left, window.innerWidth - MENU_WIDTH - 4)),
    })
  }, [anchor])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // capture 로 받아야 아래 깔린 것들보다 먼저 닫힌다.
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  if (!spot) return null

  return (
    <div ref={ref} className="menu bevel-out tabs__menu" style={spot}>
      <button className="menu__item" onClick={run(() => void useCanvases.getState().createCanvas())}>
        <span className="menu__key">{say('tabs.createNew')}</span>
      </button>
      <button className="menu__item" onClick={run(() => void useCanvases.getState().openCanvas())}>
        <span className="menu__key">{say('tabs.openFile')}</span>
      </button>

      <div className="menu__sep" />
      <div className="tabs__menuhead">{say('tabs.recent')}</div>

      {recent.length === 0 ? (
        <div className="tabs__menunone">{say('tabs.recentNone')}</div>
      ) : (
        recent.map((entry) => (
          <button
            key={entry.path}
            className="menu__item"
            // 전체 경로는 이름만 봐서는 어느 것인지 모를 때를 위해 남겨 둔다.
            title={entry.path}
            onClick={run(() => void useCanvases.getState().openRecent(entry.path))}
          >
            <span className="menu__key tabs__menuname">{entry.name || baseName(entry.path)}</span>
            {openPaths.includes(entry.path) && <span className="menu__hint">{say('tabs.alreadyOpen')}</span>}
          </button>
        ))
      )}

      {recent.length > 0 && (
        <>
          <div className="menu__sep" />
          {/* 실수로 스치기 쉬운 자리다. 되돌릴 수 없으니 한 번 더 묻는다.
              메뉴는 먼저 닫는다 — 뒤에 메뉴가 깔린 채로 물으면 무엇에 답하는지 헷갈린다. */}
          <button className="menu__item" onClick={run(forgetRecent)}>
            <span className="menu__key">{say('tabs.forgetRecent')}</span>
          </button>
        </>
      )}
    </div>
  )
}
