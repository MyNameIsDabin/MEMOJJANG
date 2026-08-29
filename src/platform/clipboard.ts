/** 클립보드 읽기/쓰기. Tauri 안에서는 플러그인을, 브라우저에서는 웹 API 를 쓴다. */
import { isTauri } from './env'
import { t } from '../i18n'

export async function copyText(text: string): Promise<void> {
  if (isTauri()) {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
    await writeText(text)
  } else {
    await navigator.clipboard.writeText(text)
  }
}

/** 이미지 노트를 다시 클립보드로 올린다. url 은 blob: 또는 data: 둘 다 받는다. */
export async function copyImageFromUrl(url: string): Promise<void> {
  await copyImageBlob(await (await fetch(url)).blob())
}

/** 그림 한 장을 클립보드에 올린다. */
export async function copyImageBlob(blob: Blob): Promise<void> {
  if (isTauri()) {
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
