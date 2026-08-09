/** 스토어 바깥에서 도는 부수효과 — 자동 저장과 설정 반영.
 *  컴포넌트가 아니라 여기 모아둬야 렌더 순서와 무관하게 한 번만 걸린다. */
import { useBoard } from './boardStore'
import { saveActiveCanvas, useCanvases } from './canvasStore'
import { applySettings, pickSettings, useSettings, type Settings } from './settingsStore'
import { storage } from '../platform/storage'
import { setAlwaysOnTop, setClipboardWatch, setCloseToTray, setGlobalHotkey } from '../platform/window'
import { describeError, notify } from '../ui/toast'

const SAVE_DELAY = 600

/** 보드가 바뀌면 잠시 뒤 지금 캔버스 파일에 쓴다.
 *  타이핑 중에 매 글자 저장하지 않도록 미룬다. */
export function startBoardAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    if (!useBoard.getState().hydrated) return
    // 캔버스를 갈아 끼우는 중이면 그쪽이 저장까지 책임진다.
    if (useCanvases.getState().busy) return
    void saveActiveCanvas().catch((err) => {
      console.error('[autosave] 저장 실패', err)
      // 저장이 안 되고 있다는 사실은 반드시 알아야 한다. 모르고 계속 쓰면 다 날아간다.
      notify(`캔버스를 저장하지 못했습니다 — ${describeError(err)}`, 'error')
    })
  }

  const unsubscribe = useBoard.subscribe((s, prev) => {
    if (!s.hydrated) return
    // 방금 파일에서 읽어온 것을 그대로 되쓸 필요는 없다.
    if (!prev.hydrated) return
    // 선택 영역이나 되돌리기 스택만 바뀐 경우도 저장할 게 없다.
    if (s.notes === prev.notes && s.noteIds === prev.noteIds && s.viewport === prev.viewport) return
    clearTimeout(timer)
    timer = setTimeout(flush, SAVE_DELAY)
  })

  // 창을 닫거나 숨길 때 미뤄둔 저장을 밀어낸다.
  const onHide = () => {
    if (timer) flush()
  }
  window.addEventListener('beforeunload', onHide)
  window.addEventListener('blur', onHide)
  document.addEventListener('visibilitychange', onHide)

  return () => {
    unsubscribe()
    window.removeEventListener('beforeunload', onHide)
    window.removeEventListener('blur', onHide)
    document.removeEventListener('visibilitychange', onHide)
    flush()
  }
}

/** 설정 변경을 화면·창·Rust 쪽에 전파하고 파일로 남긴다. */
export function startSettingsEffects(): () => void {
  let prev: Settings | null = null

  const apply = (next: Settings, first: boolean) => {
    const looksChanged =
      next.font !== prev?.font ||
      next.fontScale !== prev?.fontScale ||
      next.theme !== prev?.theme ||
      next.themeColors !== prev?.themeColors
    if (first || looksChanged) applySettings(next)
    if (first || next.alwaysOnTop !== prev?.alwaysOnTop) void setAlwaysOnTop(next.alwaysOnTop)
    if (first || next.minimizeToTray !== prev?.minimizeToTray) void setCloseToTray(next.minimizeToTray)
    if (first || next.clipboardWatch !== prev?.clipboardWatch) void setClipboardWatch(next.clipboardWatch)
    if (first || next.globalHotkey !== prev?.globalHotkey) {
      setGlobalHotkey(next.globalHotkey).catch((err) => {
        console.error('[hotkey] 등록 실패', err)
        notify(`전역 단축키를 걸지 못했습니다 — ${describeError(err)}`, 'error')
      })
    }
  }

  const unsubscribe = useSettings.subscribe((state) => {
    if (!state.hydrated) return
    const next = pickSettings(state)
    const first = prev === null
    apply(next, first)
    if (!first && JSON.stringify(next) !== JSON.stringify(prev)) {
      void storage.saveSettings(next).catch((err) => console.error('[settings] 저장 실패', err))
    }
    prev = next
  })

  // 설정을 이미 다 읽어온 뒤에 붙었다면 구독만으로는 아무 일도 일어나지 않는다.
  // 그 경우 지금 값으로 한 번 반영해 준다.
  const current = useSettings.getState()
  if (current.hydrated) {
    prev = pickSettings(current)
    apply(prev, true)
  }

  return unsubscribe
}
