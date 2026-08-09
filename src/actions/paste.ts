/** 붙여넣기 — 메모짱에서 제일 자주 쓰이는 동작.
 *
 *  붙이는 방법이 두 가지다.
 *  - Ctrl+V: 웹의 paste 이벤트. 웹뷰가 원본 그대로 얹어주므로 손실이 없다.
 *  - 직접 읽기: 우클릭 메뉴처럼 이벤트가 없을 때, 그리고 위 이벤트가 오지 않을 때의 대비책.
 */
import { newId } from '../types'
import { useBoard } from '../store/boardStore'
import { extractUrls } from '../utils/url'
import { saveImage } from '../platform/assets'
import { files } from '../platform/files'
import { isTauri } from '../platform/env'
import { isTextField } from '../utils/dom'
import { describeError, notify } from '../ui/toast'
import { isNoteClip, pasteNotes } from './clip'

async function measure(blob: Blob): Promise<{ width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(blob)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return { width: 0, height: 0 }
  }
}

/** 이미지 한 장을 보드에 얹는다. 파일로 저장한 뒤 이름만 노트에 남긴다. */
export async function addImageBlob(blob: Blob, world: { x: number; y: number }): Promise<void> {
  const [{ width, height }, buffer] = await Promise.all([measure(blob), blob.arrayBuffer()])
  const mime = blob.type || 'image/png'
  const file = await saveImage(new Uint8Array(buffer), mime)
  useBoard.getState().addImage({ file, naturalW: width, naturalH: height }, world)
}

/** 붙여넣은 글자를 어디로 보낼지 정한다.
 *
 *  메모지를 통째로 복사해 둔 것이면 노트로 되살린다 — 우리가 담은 표식이 붙어 있다.
 *  바로가기 노트 하나만 골라 둔 채로 주소를 붙이면, 새 노트를 만드는 대신 그 목록에 넣는다.
 *  주소를 모으는 중에 붙여넣기를 했다면 십중팔구 그 뜻이기 때문이다. */
export function addTextClip(text: string, world: { x: number; y: number }): void {
  if (isNoteClip(text)) {
    void pasteNotes(text, world).catch((err) => {
      console.error('[clip] 메모지 붙여넣기 실패', err)
      notify(`메모지를 붙여넣지 못했습니다 — ${describeError(err)}`, 'error')
    })
    return
  }
  if (appendToSelectedLinkNote(text)) return
  useBoard.getState().addMemo(text, world)
}

function appendToSelectedLinkNote(text: string): boolean {
  const { notes, selection, patchNote } = useBoard.getState()
  // 여러 개를 골라 뒀으면 어디에 넣을지 알 수 없다. 그럴 땐 평소대로 새 메모를 만든다.
  if (selection.length !== 1) return false

  const note = notes[selection[0]]
  if (note?.kind !== 'link') return false

  const urls = extractUrls(text)
  if (!urls.length) return false

  patchNote(note.id, {
    items: [...note.items, ...urls.map((url) => ({ id: newId(), url, label: '' }))],
  })
  // 새 노트가 안 생기므로 아무 일도 없던 것처럼 보일 수 있다. 어디로 갔는지 알려 준다.
  notify(`바로가기 ${urls.length}개를 "${note.title}" 에 넣었습니다.`)
  return true
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']

/** 파일에서 그림을 골라 보드에 얹는다. 클립보드를 거치지 않는 경로다. */
export async function addImageFromFile(world: { x: number; y: number }): Promise<void> {
  try {
    const blob = await pickImageFile()
    if (!blob) return
    await addImageBlob(blob, world)
  } catch (err) {
    console.error('[image] 그림 불러오기 실패', err)
    notify(`그림을 불러오지 못했습니다 — ${describeError(err)}`, 'error')
  }
}

async function pickImageFile(): Promise<Blob | null> {
  if (!isTauri()) {
    // 브라우저에서는 파일 대화상자를 직접 띄운다.
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = () => resolve(input.files?.[0] ?? null)
      input.click()
    })
  }

  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({
    title: '그림 불러오기',
    multiple: false,
    directory: false,
    filters: [{ name: '그림', extensions: IMAGE_EXTENSIONS }],
  })
  if (typeof picked !== 'string') return null

  const base64 = await files.readBinary(picked)
  if (!base64) throw new Error('파일을 읽지 못했습니다')

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeForPath(picked) })
}

function mimeForPath(path: string): string {
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg'
  if (/\.gif$/i.test(path)) return 'image/gif'
  if (/\.webp$/i.test(path)) return 'image/webp'
  if (/\.bmp$/i.test(path)) return 'image/bmp'
  return 'image/png'
}

/** 클립보드에서 그림을 꺼낸다.
 *
 *  붙여넣기 원본에 따라 그림이 실려 오는 자리가 다르다. 스크린샷처럼 운영체제가
 *  비트맵만 올린 경우는 `files` 에, 브라우저에서 복사한 그림은 `items` 에 들어온다.
 *  둘 다 뒤져야 "왜 어떤 건 붙고 어떤 건 안 붙지" 를 겪지 않는다. */
function pickImage(data: DataTransfer): File | null {
  for (const file of Array.from(data.files)) {
    if (file.type.startsWith('image/')) return file
  }
  for (const item of Array.from(data.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  return null
}

function reportPasteFailure(err: unknown): void {
  console.error('[paste] 이미지 붙여넣기 실패', err)
  notify(`이미지를 붙여넣지 못했습니다 — ${describeError(err)}`, 'error')
}

/* ── 한 번의 Ctrl+V, 두 개의 경로 ────────────────────────────────────────
 *
 *  보통은 웹의 paste 이벤트가 와서 그쪽이 처리한다(원본 그대로라 손실이 없다).
 *  이벤트가 오지 않으면 아래 폴백이 클립보드를 직접 읽는다.
 *  둘 중 어느 쪽이 먼저 끝나든 노트는 하나만 생기도록 claimPaste 로 잠근다. */

let lastPasteAt = 0
const PASTE_LOCK = 400
const FALLBACK_DELAY = 150

function claimPaste(): boolean {
  const now = Date.now()
  if (now - lastPasteAt < PASTE_LOCK) return false
  lastPasteAt = now
  return true
}

/** window 의 paste 이벤트에 물린다. */
export function handlePasteEvent(e: ClipboardEvent, world: { x: number; y: number }): void {
  if (isTextField(e.target)) return

  const data = e.clipboardData
  if (!data) return

  const image = pickImage(data)
  if (image) {
    e.preventDefault()
    if (claimPaste()) addImageBlob(image, world).catch(reportPasteFailure)
    return
  }

  const text = data.getData('text/plain')
  if (text) {
    e.preventDefault()
    if (claimPaste()) addTextClip(text, world)
  }

  // 아무것도 못 찾았어도 여기서 "없다" 고 단정하지 않는다.
  // 폴백이 클립보드를 다시 읽어 보고, 그래도 없을 때 한 번만 알린다.
}

/** paste 이벤트를 잠깐 기다렸다가, 안 오면 클립보드를 직접 읽는다. */
export function schedulePasteFallback(world: { x: number; y: number }): void {
  const requestedAt = Date.now()
  setTimeout(() => {
    if (lastPasteAt >= requestedAt) return
    void pasteFromClipboard(world)
  }, FALLBACK_DELAY)
}

function rgbaToPngBlob(rgba: Uint8Array, width: number, height: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/** paste 이벤트 없이 클립보드를 직접 읽어 붙인다 (우클릭 메뉴 등). */
export async function pasteFromClipboard(world: { x: number; y: number }): Promise<void> {
  try {
    if (await pasteImageFromClipboard(world)) return
    const text = await readClipboardText()
    if (text) {
      if (claimPaste()) addTextClip(text, world)
      return
    }
    notify('클립보드에 붙여넣을 만한 것이 없습니다.')
  } catch (err) {
    reportPasteFailure(err)
  }
}

/** 그림을 붙였으면 true. 클립보드에 그림이 없으면 false 를 돌려주고 조용히 물러난다. */
async function pasteImageFromClipboard(world: { x: number; y: number }): Promise<boolean> {
  if (isTauri()) {
    const { readImage } = await import('@tauri-apps/plugin-clipboard-manager')

    // 그림이 없으면 플러그인이 실패로 알려준다. 그건 오류가 아니라 "없음" 이다.
    let rgba: Uint8Array
    let size: { width: number; height: number }
    try {
      const image = await readImage()
      ;[rgba, size] = await Promise.all([image.rgba(), image.size()])
    } catch {
      return false
    }

    const png = await rgbaToPngBlob(rgba, size.width, size.height)
    if (!png) throw new Error('png 로 변환하지 못했습니다')
    if (claimPaste()) await addImageBlob(png, world)
    // 이미 처리됐더라도 "그림이 있었다" 는 사실은 그대로다 — 텍스트로 넘어가면 안 된다.
    return true
  }

  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith('image/'))
      if (type) {
        if (claimPaste()) await addImageBlob(await item.getType(type), world)
        return true
      }
    }
  } catch {
    // 권한 거부 등 — 텍스트로 넘어간다
  }
  return false
}

async function readClipboardText(): Promise<string> {
  if (isTauri()) {
    const { readText } = await import('@tauri-apps/plugin-clipboard-manager')
    return readText().catch(() => '')
  }
  return navigator.clipboard.readText().catch(() => '')
}
