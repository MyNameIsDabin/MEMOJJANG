/** 화면 캡처 시작.
 *
 *  메뉴에서도, 전역 단축키에서도 같은 길로 들어온다. 다른 점은 잡은 그림을 어디에 놓느냐뿐이라
 *  자리를 받아 두고 나머지는 CaptureOverlay 에 맡긴다. */
import { beginCapture } from '../platform/capture'
import { dropPoint } from '../canvas/pointer'
import { useUi } from '../store/uiStore'
import { useSettings } from '../store/settingsStore'
import { describeError, notify } from '../ui/toast'
import { t } from '../i18n'

/** 자리를 주지 않으면 지금 화면 한가운데에 놓는다 — 단축키로 부를 때가 그렇다. */
export async function startCapture(world?: { x: number; y: number }): Promise<void> {
  // 이미 고르는 중이면 아무것도 하지 않는다. 겹쳐 부르면 얼린 그림이 서로를 덮어쓴다.
  if (useUi.getState().capture) return

  try {
    const shot = await beginCapture(useSettings.getState().hideOnCapture)
    useUi.getState().startCapture(shot, world ?? dropPoint())
  } catch (err) {
    console.error('[capture] 시작 실패', err)
    notify(t('toast.captureFailed', { reason: describeError(err) }), 'error')
  }
}

/** 전역 단축키가 눌리면 Rust 가 이 이름으로 알려 준다. 창이 트레이에 숨어 있어도 도착한다. */
const CAPTURE_EVENT = 'hotkey://capture'

/** 단축키 신호를 듣기 시작한다. 되돌려 주는 함수를 부르면 끊는다. */
export function listenForCaptureHotkey(): () => void {
  let stop: (() => void) | null = null
  let dead = false

  void import('@tauri-apps/api/event')
    .then(({ listen }) => listen(CAPTURE_EVENT, () => void startCapture()))
    .then((unlisten) => {
      // 듣기 시작하기도 전에 화면이 내려갔으면 바로 끊는다.
      if (dead) unlisten()
      else stop = unlisten
    })
    .catch((err) => console.error('[capture] 단축키 신호를 듣지 못했습니다', err))

  return () => {
    dead = true
    stop?.()
  }
}
