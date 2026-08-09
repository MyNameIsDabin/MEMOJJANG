/** 끌어다 놓기.
 *
 *  놓이는 것이 세 갈래다.
 *  - 탐색기에서 끌어온 **파일** — 바이트가 그대로 온다. 제일 쉽다.
 *  - 브라우저에서 끌어온 **그림** — 파일이 아니라 주소가 온다. 받아와야 한다.
 *  - 그냥 **글이나 링크** — 붙여넣기와 같은 길로 보낸다.
 */
import { addImageBlob, addTextClip } from './paste'
import { isTauri } from '../platform/env'
import { base64ToBlob } from '../utils/bytes'
import { isTextField } from '../utils/dom'
import { describeError, notify } from '../ui/toast'
import { t } from '../i18n'

/** 브라우저는 끌어온 그림을 여러 형식으로 함께 실어 보낸다. 쓸 만한 순서대로 뒤진다. */
function pickUrl(data: DataTransfer): string | null {
  // 표준 형식. 주석 줄(#)이 섞여 올 수 있다.
  const uriList = data.getData('text/uri-list')
  if (uriList) {
    const first = uriList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#'))
    if (first) return first
  }

  // 그림을 끌면 <img> 조각이 함께 온다. 스크립트를 돌리지 않는 파서로 src 만 꺼낸다.
  const html = data.getData('text/html')
  if (html) {
    const src = new DOMParser().parseFromString(html, 'text/html').querySelector('img')?.getAttribute('src')
    if (src) return src
  }

  const text = data.getData('text/plain').trim()
  return text || null
}

function isDataImageUrl(url: string): boolean {
  return /^data:image\//i.test(url)
}

/** `data:image/png;base64,...` 를 그대로 뜯는다. 네트워크가 필요 없다. */
function blobFromDataUrl(url: string): Blob | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/is.exec(url)
  if (!match) return null
  const [, mime, base64Flag, payload] = match
  return base64Flag
    ? base64ToBlob(payload, mime)
    : new Blob([decodeURIComponent(payload)], { type: mime })
}

async function downloadImage(url: string): Promise<Blob> {
  if (!isTauri()) throw new Error(t('err.browserImage'))
  const { invoke } = await import('@tauri-apps/api/core')
  const result = await invoke<{ mime: string; base64: string }>('download_image', { url })
  return base64ToBlob(result.base64, result.mime)
}

/** 놓인 것을 보드에 얹는다. */
export async function handleDrop(data: DataTransfer, world: { x: number; y: number }): Promise<void> {
  // 1. 파일로 왔으면 그대로 쓴다 — 가장 손실이 없다.
  const file = Array.from(data.files).find((f) => f.type.startsWith('image/'))
  if (file) {
    await addImageBlob(file, world).catch((err) => {
      notify(t('err.dropFailed', { reason: describeError(err) }), 'error')
    })
    return
  }

  const url = pickUrl(data)
  if (!url) return

  // 2. 내용이 주소 안에 통째로 담겨 온 경우.
  if (isDataImageUrl(url)) {
    const blob = blobFromDataUrl(url)
    if (blob) {
      await addImageBlob(blob, world)
      return
    }
  }

  // 3. 웹에 있는 그림. 받아와 보고, 그림이 아니면 주소·글로 다룬다.
  if (/^https?:\/\//i.test(url)) {
    try {
      await addImageBlob(await downloadImage(url), world)
      return
    } catch (err) {
      // "그림이 아님" 은 실패가 아니라 갈림길이다. 링크로 받아 준다.
      const message = describeError(err)
      if (!message.includes(t('err.dropNotImage'))) {
        notify(t('err.fetchImage', { reason: message }), 'error')
        return
      }
    }
  }

  // 4. 남은 것은 글이거나 주소. 붙여넣기와 같은 규칙을 탄다
  //    (바로가기 노트를 골라 뒀으면 그 목록으로 들어간다).
  addTextClip(url, world)
}

/** 이 드롭을 우리가 다뤄야 하는가. 입력 칸 안에서는 브라우저 기본 동작이 낫다. */
export function shouldHandleDrop(target: EventTarget | null): boolean {
  return !isTextField(target)
}
