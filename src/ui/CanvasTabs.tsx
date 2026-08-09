/** 캔버스 탭. 탭 하나가 파일 하나다.
 *  창 제목 표시줄 안에 얹히므로 테두리 없는 요즘 스타일로 그린다. */
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCanvases } from '../store/canvasStore'
import { Icon } from './Icon'
import { useT } from '../i18n'
import './tabs.css'

export function CanvasTabs() {
  const canvases = useCanvases(useShallow((s) => s.canvases))
  const activeId = useCanvases((s) => s.activeId)
  const busy = useCanvases((s) => s.busy)
  const [renamingId, setRenamingId] = useState<string | null>(null)
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
        type="button"
        className="tabs__btn"
        disabled={busy}
        title={say('tabs.new')}
        onClick={() => void useCanvases.getState().createCanvas()}
      >
        <Icon name="plus" />
      </button>
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
