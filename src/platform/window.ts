/** 창 관련 동작. 브라우저에서는 전부 조용히 넘어간다. */
import { isTauri } from './env'

export async function setAlwaysOnTop(on: boolean): Promise<void> {
  if (!isTauri()) return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().setAlwaysOnTop(on)
}

/** 닫기 버튼을 눌렀을 때 종료할지 트레이로 숨길지 Rust 쪽에 알려준다. */
export async function setCloseToTray(on: boolean): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_close_to_tray', { enabled: on })
}

/** 전역 단축키를 다시 건다. null 이면 끈다.
 *  이미 다른 프로그램이 쓰는 조합이면 예외가 올라오므로 부르는 쪽에서 알려 줘야 한다. */
export async function setGlobalHotkey(accelerator: string | null): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_global_hotkey', { accelerator })
}

/** 클립보드 감시 스레드를 켜고 끈다. */
export async function setClipboardWatch(on: boolean): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_clipboard_watch', { enabled: on })
}
