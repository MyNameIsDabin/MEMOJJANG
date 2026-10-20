/** 클립보드 읽기/쓰기. Tauri 안에서는 플러그인을, 브라우저에서는 웹 API 를 쓴다. */
import { isTauri } from './env'
import { t } from '../i18n'
import { bytesToBase64 } from '../utils/bytes'

export async function copyText(text: string): Promise<void> {
  if (isTauri()) {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
    await writeText(text)
  } else {
    await navigator.clipboard.writeText(text)
  }
}

/** 윈도우 클립보드에 그림을 직접 올린다 (CF_DIBV5 + PNG). 되면 true.
 *
 *  그림 노트 Ctrl+C 와 같은 길이다 — 복사 단추나 캡처로 올린 것도 같은 모습으로 붙게 한다.
 *  PNG 도 그대로 실어서, PNG 를 먼저 찾는 프로그램에서는 투명도가 산다.
 *  윈도우가 아니거나 실패하면 false 를 돌려주고, 부르는 쪽이 플러그인으로 되돌아간다. */
async function copyPngRich(png: Blob): Promise<boolean> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const bytes = new Uint8Array(await png.arrayBuffer())
    await invoke('copy_image_rich', { base64Png: bytesToBase64(bytes) })
    return true
  } catch (err) {
    console.warn('[clipboard] 그림을 직접 올리지 못했습니다', err)
    return false
  }
}

/** 이미지 노트를 다시 클립보드로 올린다. url 은 blob: 또는 data: 둘 다 받는다. */
export async function copyImageFromUrl(url: string): Promise<void> {
  await copyImageBlob(await (await fetch(url)).blob())
}

/** 그림 한 장을 클립보드에 올린다. */
export async function copyImageBlob(blob: Blob): Promise<void> {
  if (isTauri()) {
    if (blob.type === 'image/png' && (await copyPngRich(blob))) return
    const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager')
    // 플러그인은 png 바이트를 그대로 받는다 (Cargo 의 image-png 기능 필요).
    await writeImage(new Uint8Array(await blob.arrayBuffer()))
    return
  }

  // 웹 클립보드는 png 만 확실히 받아준다. 다른 형식이면 png 로 다시 굽는다.
  const png = blob.type === 'image/png' ? blob : await transcodeToPng(blob)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

async function transcodeToPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t('err.pngConvert')))), 'image/png'),
  )
}
