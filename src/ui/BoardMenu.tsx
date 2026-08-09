/** 빈 캔버스에서 오른쪽 클릭했을 때 뜨는 메뉴. 누른 자리에 노트를 놓는다. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toWorld, useBoard } from '../store/boardStore'
import { useUi } from '../store/uiStore'
import { addImageFromFile, pasteFromClipboard } from '../actions/paste'
import { arrangeGrid, zoomToFit } from '../actions/layout'
import { copyNotes } from '../actions/clip'
import { beginCapture } from '../platform/capture'
import { isTauri } from '../platform/env'
import { describeError, notify } from './toast'
import { t, useT } from '../i18n'
import './menu.css'

/** 화면을 얼려 놓고 캡처 화면으로 넘어간다. 창을 넓히는 일은 Rust 가 맡는다. */
async function startCapture(world: { x: number; y: number }): Promise<void> {
  try {
    const shot = await beginCapture()
    useUi.getState().startCapture(shot, world)
  } catch (err) {
    console.error('[capture] 시작 실패', err)
    notify(t('toast.captureFailed', { reason: describeError(err) }), 'error')
  }
}

export interface MenuAnchor {
  screenX: number
  screenY: number
}

export function BoardMenu({ anchor, onClose }: { anchor: MenuAnchor; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: anchor.screenX, top: anchor.screenY })
  const say = useT()
  const selection = useBoard((s) => s.selection)

  // 화면 밖으로 삐져나가면 안쪽으로 당긴다.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      left: Math.min(anchor.screenX, window.innerWidth - width - 4),
      top: Math.min(anchor.screenY, window.innerHeight - height - 4),
    })
  }, [anchor])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // capture 단계로 받아야 캔버스의 포인터 핸들러보다 먼저 닫을 수 있다.
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const world = () => toWorld(useBoard.getState().viewport, anchor.screenX, anchor.screenY)

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <div ref={ref} className="menu bevel-out" style={pos} onContextMenu={(e) => e.preventDefault()}>
      <button className="menu__item" onClick={run(() => useBoard.getState().addNote('todo', world()))}>
        <span className="menu__key">{say('menu.addTodo')}</span>
        <span className="menu__hint">Ctrl+1</span>
      </button>
      <button className="menu__item" onClick={run(() => useBoard.getState().addNote('memo', world()))}>
        <span className="menu__key">{say('menu.addMemo')}</span>
        <span className="menu__hint">Ctrl+2</span>
      </button>
      <button className="menu__item" onClick={run(() => useBoard.getState().addNote('link', world()))}>
        <span className="menu__key">{say('menu.addLink')}</span>
        <span className="menu__hint">Ctrl+3</span>
      </button>
      <button className="menu__item" onClick={run(() => void addImageFromFile(world()))}>
        <span className="menu__key">{say('menu.image')}</span>
      </button>
      <button
        className="menu__item"
        disabled={!isTauri()}
        onClick={run(() => void startCapture(world()))}
        title={say('menu.captureHint')}
      >
        <span className="menu__key">{say('menu.capture')}</span>
      </button>

      <div className="menu__sep" />

      <button
        className="menu__item"
        disabled={!selection.length}
        onClick={run(() => void copyNotes(useBoard.getState().selection))}
        title={say('menu.copyNotesHint')}
      >
        <span className="menu__key">{say('menu.copyNotes')}</span>
        <span className="menu__hint">Ctrl+C</span>
      </button>
      <button className="menu__item" onClick={run(() => void pasteFromClipboard(world()))}>
        <span className="menu__key">{say('menu.paste')}</span>
        <span className="menu__hint">Ctrl+V</span>
      </button>
      <button
        className="menu__item"
        onClick={run(() => {
          const { noteIds, select } = useBoard.getState()
          select(noteIds)
        })}
      >
        <span className="menu__key">{say('menu.selectAll')}</span>
        <span className="menu__hint">Ctrl+A</span>
      </button>

      <div className="menu__sep" />

      <button
        className="menu__item"
        onClick={run(() => useBoard.getState().setViewport((vp) => ({ ...vp, zoom: 1 })))}
      >
        <span className="menu__key">{say('menu.zoom100')}</span>
        <span className="menu__hint">Ctrl+0</span>
      </button>
      <button className="menu__item" onClick={run(() => zoomToFit())}>
        <span className="menu__key">{say('menu.fit')}</span>
        <span className="menu__hint">Ctrl+Shift+0</span>
      </button>
      <button className="menu__item" onClick={run(() => arrangeGrid(useBoard.getState().selection))}>
        <span className="menu__key">{say('menu.arrange')}</span>
        <span className="menu__hint">Ctrl+Shift+G</span>
      </button>
      <button className="menu__item" onClick={run(useUi.getState().openSearch)}>
        <span className="menu__key">{say('menu.find')}</span>
        <span className="menu__hint">Ctrl+F</span>
      </button>
    </div>
  )
}
