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
  if (text) return text

  return urlFromOwnFormats(data)
}

/** 주소처럼 생긴 것. 확장자로 그림인지 가른다 — 속을 들여다볼 수 없는 글에서 찾는 것이라 이게 최선이다. */
const IMAGE_URL = /https?:\/\/[^\s"'<>\\)]+\.(?:jpe?g|png|gif|webp|avif)(?:\?[^\s"'<>\\)]*)?/i

/** 사이트가 **제 나름의 형식으로만** 실어 보낸 경우의 마지막 수단.
 *
 *  핀터레스트가 그렇다. 표준 형식(`text/uri-list`·`text/html`·`text/plain`)을 하나도 넣지 않고
 *  `application/x-pinterest-closeup-image` 안에만 제 정보를 담는다. 그래서 여태 놓아도
 *  아무 일이 없었다 — 우리가 뒤지는 자리에 아무것도 없었기 때문이다.
 *
 *  형식마다 속이 어떻게 생겼는지는 알 수 없고, 사이트마다 또 다르다. 그래서 해석하지 않고
 *  **글로 읽어 그림 주소처럼 생긴 것을 찾는다.** 사이트가 형식을 바꿔도 주소는 주소로 남는다. */
function urlFromOwnFormats(data: DataTransfer): string | null {
  for (const type of data.types) {
    // 표준 자리는 이미 위에서 뒤졌고, Files 는 부르는 쪽이 먼저 본다.
    if (type === 'Files' || type.startsWith('text/')) continue

    let raw = ''
    try {
      raw = data.getData(type)
    } catch {
      continue
    }
    if (!raw) continue

    // JSON 안에 담겨 오면 빗금이 `\/` 로 escape 되어 있다. 되돌려야 주소로 읽힌다.
    const found = IMAGE_URL.exec(raw.split('\\/').join('/'))
    if (found) return found[0]
  }
  return null
}

function isDataImageUrl(url: string): boolean {
  return /^data:image\//i.test(url)
}

/** 브라우저가 알려 준 "그림이 아니다". 사람이 읽는 말이 아니라 표식으로 견준다. */
const NOT_IMAGE = 'memojjang/not-image'

/** 이 꾸러미가 그림을 싣고 있는가.
 *
 *  글 쓰는 칸 위에 떨어졌을 때 누가 가져갈지를 가른다. 글은 브라우저에게 맡기는 편이 낫다 —
 *  커서 자리에 그대로 꽂힌다. 그림은 이야기가 다르다. 어디에 떨어뜨렸든 노트가 되어야 한다. */
export function carriesImage(data: DataTransfer): boolean {
  if (Array.from(data.files).some((f) => f.type.startsWith('image/'))) return true
  const html = data.getData('text/html')
  if (html && new DOMParser().parseFromString(html, 'text/html').querySelector('img')) return true
  if (isDataImageUrl(data.getData('text/uri-list') || data.getData('text/plain'))) return true
  // 사이트가 제 형식에만 담아 보낸 그림도 그림이다 (핀터레스트).
  return urlFromOwnFormats(data) !== null
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
  if (!url) {
    // 말없이 끝내면 "떨어뜨렸는데 아무 일도 안 난다" 가 된다. 무엇이 왔는지라도 알려 준다.
    notify(t('err.dropNothing', { types: Array.from(data.types).join(', ') || '-' }), 'error')
    return
  }

  // 2. 내용이 주소 안에 통째로 담겨 온 경우.
  if (isDataImageUrl(url)) {
    const blob = blobFromDataUrl(url)
    if (blob) {
      await addImageBlob(blob, world).catch((err) => {
        notify(t('err.dropFailed', { reason: describeError(err) }), 'error')
      })
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
      if (!message.includes(NOT_IMAGE)) {
        notify(t('err.fetchImage', { reason: message }), 'error')
        return
      }
    }
  }

  // 4. 남은 것은 글이거나 주소. 붙여넣기와 같은 규칙을 탄다
  //    (바로가기 노트를 골라 뒀으면 그 목록으로 들어간다).
  addTextClip(url, world)
}

/** 이 드롭을 우리가 다뤄야 하는가.
 *
 *  입력 칸 안에 **글**을 떨어뜨리는 것은 브라우저가 더 잘한다 — 커서 자리에 꽂아 준다.
 *  하지만 **그림**은 우리가 가져와야 한다. 메모 본문이 CodeMirror 로 바뀌면서 노트 본문이
 *  통째로 `contenteditable` 이 되었고, 그 위에 그림을 떨어뜨리면 아무 일도 일어나지 않았다. */
export function shouldHandleDrop(target: EventTarget | null, data: DataTransfer): boolean {
  return !isTextField(target) || carriesImage(data)
}
