/** 캔버스 탭. 탭 하나가 파일 하나다.
 *  창 제목 표시줄 안에 얹히므로 테두리 없는 요즘 스타일로 그린다. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCanvases } from '../store/canvasStore'
import { baseName } from '../platform/files'
import { confirmAsk } from './confirm'
import { Icon } from './Icon'
import { t, useT } from '../i18n'
import './tabs.css'

export function CanvasTabs() {
  const canvases = useCanvases(useShallow((s) => s.canvases))
  const activeId = useCanvases((s) => s.activeId)
  const busy = useCanvases((s) => s.busy)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)
  const say = useT()

  return (
    <div className="tabs">
      <div className="tabs__strip">
        {canvases.map((canvas) => {
          const active = canvas.id === activeId
          return (
            <div key={canvas.id} className={`tab${active ? ' tab--on' : ''}`} title={canvas.path}>
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
                    onClick={() => void useCanvases.getState().switchTo(canvas.id)}
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
