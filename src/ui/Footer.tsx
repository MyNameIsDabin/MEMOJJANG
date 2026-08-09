/** 화면 맨 아래 상태 줄. 늘 보이지만 자리는 거의 안 차지해야 하는 것들만 둔다. */
import { MAX_ZOOM, MIN_ZOOM, useBoard } from '../store/boardStore'
import { useCanvases } from '../store/canvasStore'
import { useSettings } from '../store/settingsStore'
import { useUi } from '../store/uiStore'
import { setAlwaysOnTop } from '../platform/window'
import { Icon } from './Icon'
import { NoteListMenu } from './NoteListMenu'
import './footer.css'

export function Footer() {
  const zoom = useBoard((s) => s.viewport.zoom)
  const count = useBoard((s) => s.noteIds.length)
  const alwaysOnTop = useSettings((s) => s.alwaysOnTop)
  const canvasName = useCanvases((s) => s.canvases.find((c) => c.id === s.activeId)?.name ?? null)
  const listOpen = useUi((s) => s.noteList)

  const zoomBy = (factor: number) =>
    useBoard.getState().zoomAt(window.innerWidth / 2, window.innerHeight / 2, factor)

  const toggleTop = () => {
    const next = !alwaysOnTop
    useSettings.getState().set('alwaysOnTop', next)
    void setAlwaysOnTop(next)
  }

  return (
    <div className="footer">
      <button
        className="footer__btn"
        aria-pressed={listOpen}
        onClick={() => useUi.getState().toggleNoteList()}
        title="노트 목록에서 찾아가기"
      >
        <Icon name="search" />
      </button>
      {listOpen && <NoteListMenu onClose={useUi.getState().closeNoteList} />}

      <span className="footer__info">
        {canvasName && <span className="footer__name">{canvasName}</span>}
        <span>노트 {count}장</span>
      </span>

      <span className="footer__gap" />

      <button className="footer__btn" onClick={() => zoomBy(1 / 1.25)} disabled={zoom <= MIN_ZOOM} title="축소">
        −
      </button>
      <button
        className="footer__btn footer__zoom"
        onClick={() => useBoard.getState().setViewport((vp) => ({ ...vp, zoom: 1 }))}
        title="100% 로 되돌리기 (Ctrl+0)"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button className="footer__btn" onClick={() => zoomBy(1.25)} disabled={zoom >= MAX_ZOOM} title="확대">
        +
      </button>

      <button
        className="footer__btn"
        aria-pressed={alwaysOnTop}
        onClick={toggleTop}
        title="다른 창 위에 항상 띄우기"
      >
        <Icon name="pin" />
      </button>
    </div>
  )
}
