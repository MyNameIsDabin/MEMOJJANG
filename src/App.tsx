import { useEffect } from 'react'
import { Board } from './canvas/Board'
import { dropPoint } from './canvas/pointer'
import { TitleBar } from './ui/TitleBar'
import { Footer } from './ui/Footer'
import { SettingsPanel } from './ui/SettingsPanel'
import { SearchPanel } from './ui/SearchPanel'
import { Toasts } from './ui/Toasts'
import { useBoard } from './store/boardStore'
import { useCanvases } from './store/canvasStore'
import { useUi } from './store/uiStore'
import { loadSettings } from './store/settingsStore'
import { startBoardAutosave, startSettingsEffects } from './store/effects'
import { useShortcuts } from './hooks/useShortcuts'
import { useClipboardWatch } from './hooks/useClipboardWatch'
import './App.css'

export default function App() {
  const boardReady = useBoard((s) => s.hydrated)
  const isEmpty = useBoard((s) => s.noteIds.length === 0)
  const canvasesReady = useCanvases((s) => s.hydrated)
  const hasCanvas = useCanvases((s) => s.activeId !== null)
  const searchOpen = useUi((s) => s.search)
  const settingsOpen = useUi((s) => s.settings)

  useEffect(() => {
    // 구독을 먼저 걸어야 아래의 hydrate 가 설정 반영을 놓치지 않는다.
    const stopSettings = startSettingsEffects()
    const stopAutosave = startBoardAutosave()

    void (async () => {
      await loadSettings()
      await useCanvases.getState().hydrate()
    })()

    return () => {
      stopSettings()
      stopAutosave()
    }
  }, [])

  useShortcuts()
  useClipboardWatch()

  return (
    <>
      <Board />

      <div className="chrome">
        <TitleBar />
      </div>
      <Footer />

      {canvasesReady && !hasCanvas && <StartPanel />}
      {hasCanvas && boardReady && isEmpty && <EmptyHint />}
      {searchOpen && <SearchPanel onClose={useUi.getState().closeSearch} />}
      {settingsOpen && <SettingsPanel onClose={useUi.getState().closeSettings} />}
      <Toasts />
    </>
  )
}

/** 열려 있는 캔버스가 하나도 없을 때. 첫 실행이 여기서 시작된다. */
function StartPanel() {
  return (
    <div className="start">
      <div className="start__card bevel-out">
        <p className="start__head">캔버스를 하나 만들까요</p>
        <p className="start__body">
          메모짱은 캔버스 하나를 파일 하나로 저장합니다. 어디에 둘지 직접 고르면 되고,
          여러 개를 만들어 위쪽 탭으로 오갈 수 있습니다.
        </p>
        <div className="start__actions">
          <button className="btn" onClick={() => void useCanvases.getState().createCanvas()}>
            새 캔버스 만들기…
          </button>
          <button className="btn" onClick={() => void useCanvases.getState().openCanvas()}>
            기존 캔버스 열기…
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyHint() {
  return (
    <div className="hint">
      <div className="hint__card bevel-out">
        <p className="hint__head">아직 아무것도 없네요</p>
        <ul className="hint__list">
          <li>
            빈 곳을 <b>오른쪽 클릭</b>하면 그 자리에 노트를 놓습니다
          </li>
          <li>
            아무거나 복사한 뒤 <b>Ctrl+V</b> — 그림도 그대로 붙습니다
          </li>
          <li>
            <b>휠</b>로 밀고, <b>Ctrl+휠</b>로 확대·축소
          </li>
        </ul>
        <button className="btn hint__go" onClick={() => useBoard.getState().addNote('memo', dropPoint())}>
          메모 하나 만들어 보기
        </button>
      </div>
    </div>
  )
}
