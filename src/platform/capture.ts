/** 바탕화면 영역 캡처.
 *
 *  Rust 쪽이 화면을 통째로 찍어 얼려 주고, 창을 화면 전체로 넓혀 준다.
 *  자르는 일은 여기서 한다 — 이미 브라우저에 그림이 올라와 있어 한 번 더 오갈 이유가 없다. */
import { isTauri } from './env'
import { base64ToBlob } from '../utils/bytes'
import { t } from '../i18n'

export interface Shot {
  /** 고를 때 화면에 깔아 두는 미리보기. 오려 내기는 Rust 가 원본에서 한다. */
  url: string
  /** 가상 화면 크기(물리 픽셀). 창의 CSS 크기와 견주어 배율을 얻는다. */
  width: number
  height: number
}

async function call<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

/** 화면을 얼려 두고, 그 그림을 덮어 그릴 수 있도록 창을 화면 전체로 넓힌다.
 *  `hideWindow` 가 참이면 찍기 전에 메모짱 창을 잠깐 감춘다 — 뒤에 있던 것을 담고 싶을 때다. */
export async function beginCapture(hideWindow: boolean): Promise<Shot> {
  if (!isTauri()) throw new Error(t('err.appOnlyCapture'))
  const shot = await call<{ preview: string; width: number; height: number }>('begin_capture', {
    hideWindow,
  })
  return {
    url: URL.createObjectURL(base64ToBlob(shot.preview, 'image/jpeg')),
    width: shot.width,
    height: shot.height,
  }
}

/** 얼린 그림을 다 그렸으니 창을 화면 전체로 넓혀도 된다고 알린다.
 *
 *  begin_capture 가 곧바로 넓히지 않는 이유는 그쪽 설명 참고 — 요약하면,
 *  넓힌 창에 평소의 보드가 한 번 비치는 것을 막기 위해서다. */
export async function expandCapture(): Promise<void> {
  if (!isTauri()) return
  await call('expand_capture', {}).catch(() => {})
}

/** 창을 원래 자리로 되돌린다. 어떤 경우에도 반드시 불러야 한다. */
export async function endCapture(alwaysOnTop: boolean): Promise<void> {
  if (!isTauri()) return
  await call('end_capture', { alwaysOnTop }).catch(() => {})
}

/** 고른 자리를 오려 낸다. 화면에 깔린 미리보기가 아니라 **원본**에서 자르므로
 *  미리보기가 JPEG 여도 노트에 들어가는 그림은 화질을 잃지 않는다. 좌표는 물리 픽셀. */
export async function cropShot(rect: {
  x: number
  y: number
  w: number
  h: number
}): Promise<Blob> {
  const base64 = await call<string>('crop_capture', {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.w),
    height: Math.round(rect.h),
  })
  return base64ToBlob(base64, 'image/png')
}
