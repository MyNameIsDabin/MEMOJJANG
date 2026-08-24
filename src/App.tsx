import { useEffect } from 'react'
import { Board } from './canvas/Board'
import { dropPoint } from './canvas/pointer'
import { TitleBar } from './ui/TitleBar'
import { Footer } from './ui/Footer'
import { SettingsPanel } from './ui/SettingsPanel'
import { SearchPanel } from './ui/SearchPanel'
import { NoteStage } from './ui/NoteStage'
import { StickerBar } from './ui/StickerBar'
import { CaptureOverlay } from './ui/CaptureOverlay'
import { Toasts } from './ui/Toasts'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useT } from './i18n'
import { useBoard } from './store/boardStore'
import { useCanvases } from './store/canvasStore'
import { useUi } from './store/uiStore'
import { loadSettings } from './store/settingsStore'
import { startBoardAutosave, startSettingsEffects } from './store/effects'
import { listenForCaptureHotkey } from './actions/capture'
import { useShortcuts } from './hooks/useShortcuts'
import { useClipboardWatch } from './hooks/useClipboardWatch'
import { useChromeMetrics } from './hooks/useChromeMetrics'
import './App.css'

export default function App() {
  const boardReady = useBoard((s) => s.hydrated)
  const isEmpty = useBoard((s) => s.noteIds.length === 0)
  const canvasesReady = useCanvases((s) => s.hydrated)
  const hasCanvas = useCanvases((s) => s.activeId !== null)
  const searchOpen = useUi((s) => s.search)
  const settingsOpen = useUi((s) => s.settings)
  const fullscreenNoteId = useUi((s) => s.fullscreenNoteId)
  const decorating = useUi((s) => s.decorating)
  const activeStickerId = useUi((s) => s.activeStickerId)
  const capture = useUi((s) => s.capture)

  useEffect(() => {
    // 구독을 먼저 걸어야 아래의 hydrate 가 설정 반영을 놓치지 않는다.
    const stopSettings = startSettingsEffects()
    const stopAutosave = startBoardAutosave()
    const stopCaptureHotkey = listenForCaptureHotkey()

    void (async () => {
      await loadSettings()
      await useCanvases.getState().hydrate()
    })()

    return () => {
      stopSettings()
      stopAutosave()
      stopCaptureHotkey()
    }
  }, [])

  useShortcuts()
  useClipboardWatch()
  useChromeMetrics()

  return (
    <>
      <Board />

      {fullscreenNoteId && <NoteStage id={fullscreenNoteId} />}

      <div className="chrome">
        <TitleBar />
      </div>
      <Footer />

      {capture && (
        <CaptureOverlay
          shot={capture.shot}
          world={capture.world}
          onDone={useUi.getState().stopCapture}
        />
      )}

      {decorating && <DecorateHint />}
      {decorating && activeStickerId && <StickerBar id={activeStickerId} />}

      {canvasesReady && !hasCanvas && <StartPanel />}
      {hasCanvas && boardReady && isEmpty && !fullscreenNoteId && !decorating && <EmptyHint />}
      {searchOpen && <SearchPanel onClose={useUi.getState().closeSearch} />}
      {settingsOpen && <SettingsPanel onClose={useUi.getState().closeSettings} />}
      <Toasts />
      <ConfirmDialog />
    </>
  )
}

/** 꾸미는 중이라는 것과, 무엇을 하면 되는지를 위쪽에 한 줄로 알린다.
 *  화면이 흑백으로 죽는 것만으로는 '왜' 그런지 알 수 없기 때문이다. */
function DecorateHint() {
  const active = useUi((s) => s.activeStickerId)
  const say = useT()
  return (
    <div className="decohint">
      <span>
        {say(active ? 'deco.active' : 'deco.idle')}
      </span>
      <button className="decohint__out" onClick={() => useUi.getState().stopDecorating()}>
        {say('deco.exit')}
      </button>
    </div>
  )
}

/** 열려 있는 캔버스가 하나도 없을 때. 첫 실행이 여기서 시작된다. */
function StartPanel() {
  const say = useT()
  return (
    <div className="start">
      <div className="start__card bevel-out">
        <p className="start__head">{say('start.head')}</p>
        <p className="start__body">{say('start.body')}</p>
        <div className="start__actions">
          <button className="btn" onClick={() => void useCanvases.getState().createCanvas()}>
            {say('start.create')}
          </button>
          <button className="btn" onClick={() => void useCanvases.getState().openCanvas()}>
            {say('start.open')}
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyHint() {
  const say = useT()
  return (
    <div className="hint">
      <div className="hint__card bevel-out">
        <p className="hint__head">{say('hint.head')}</p>
        <ul className="hint__list">
          <li>{say('hint.rightClick')}</li>
          <li>{say('hint.paste')}</li>
          <li>{say('hint.wheel')}</li>
        </ul>
        <button className="btn hint__go" onClick={() => useBoard.getState().addNote('memo', dropPoint())}>
          {say('hint.go')}
        </button>
      </div>
    </div>
  )
}
