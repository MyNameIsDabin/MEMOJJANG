/** 바탕화면 영역 캡처.
 *
 *  Rust 쪽이 화면을 통째로 찍어 얼려 주고, 창을 화면 전체로 넓혀 준다.
 *  자르는 일은 여기서 한다 — 이미 브라우저에 그림이 올라와 있어 한 번 더 오갈 이유가 없다. */
import { isTauri } from './env'
import { base64ToBlob } from '../utils/bytes'

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

/** 창을 숨겨 찍고, 그 그림을 덮어 그릴 수 있도록 창을 화면 전체로 넓힌다. */
export async function beginCapture(): Promise<Shot> {
  if (!isTauri()) throw new Error('앱에서만 화면을 캡처할 수 있습니다.')
  const shot = await call<{ preview: string; width: number; height: number }>('begin_capture', {})
  return {
    url: URL.createObjectURL(base64ToBlob(shot.preview, 'image/jpeg')),
    width: shot.width,
    height: shot.height,
  }
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
