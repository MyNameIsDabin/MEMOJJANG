/** 캔버스 파일 한 벌 읽기·쓰기.
 *
 *  구성:
 *    내 보드.mjb.json      노트와 화면 위치
 *    내 보드.mjb.assets/   붙여넣은 그림들 (그림이 생길 때만 만들어진다)
 *
 *  그림을 본문에 base64 로 박지 않는 이유: 자동 저장이 파일을 통째로 다시 쓰기 때문에,
 *  그림이 몇 장만 들어가도 매번 수 MB 를 쓰게 된다. 옆에 떼어 두면 본문은 계속 가볍다.
 *  대신 파일을 옮길 때는 `.assets` 폴더도 함께 옮겨야 한다.
 */
import { CANVAS_VERSION, newId, type CanvasDoc, type Note, type Sticker } from '../types'
import { files, joinPath } from './files'
import { base64ToBlob, bytesToBase64 } from '../utils/bytes'

/** `내 보드.mjb.json` -> `내 보드.mjb.assets` */
export function assetsDirOf(canvasPath: string): string {
  return `${canvasPath.replace(/\.json$/i, '')}.assets`
}

/** 그림 이름이 `.assets` 폴더 안을 벗어나지 못하게 막는다.
 *
 *  캔버스 파일은 남에게 받을 수 있는 물건이다. 이름에 `..\..\` 같은 것이 들어 있으면
 *  그 경로가 그대로 파일 명령으로 넘어가는데, 노트를 지울 때 딸린 그림도 함께 지우므로
 *  **엉뚱한 파일이 지워질 수 있다.** 우리가 짓는 이름은 언제나 평범한 파일명 하나뿐이라
 *  여기서 잘라 내도 잃는 것이 없다. */
function safeKey(key: string): string {
  if (!key || key.includes('/') || key.includes('\\') || key.split(/[/\\]/).includes('..')) {
    throw new Error(`그림 이름이 올바르지 않습니다: ${key}`)
  }
  return key
}

export function imagePathOf(canvasPath: string, key: string): string {
  return joinPath(assetsDirOf(canvasPath), safeKey(key))
}

export function emptyCanvas(name: string): CanvasDoc {
  return { version: CANVAS_VERSION, name, notes: [], viewport: { x: 0, y: 0, zoom: 1 } }
}

/** 파일이 없으면 null, 내용이 깨졌으면 예외. 둘은 다르게 다뤄야 한다 —
 *  없는 건 새로 만들면 되지만, 깨진 건 덮어쓰기 전에 사용자에게 알려야 한다. */
export async function readCanvas(path: string): Promise<CanvasDoc | null> {
  const raw = await files.readText(path)
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`캔버스 파일을 읽을 수 없습니다 (내용이 깨졌습니다): ${String(err)}`)
  }

  const doc = parsed as Partial<CanvasDoc>
  if (!Array.isArray(doc.notes)) {
    throw new Error('캔버스 파일 형식이 아닙니다.')
  }

  return {
    version: doc.version ?? CANVAS_VERSION,
    name: doc.name ?? '',
    notes: doc.notes.map(upgradeNote).filter((n): n is Note => n !== null),
    viewport: doc.viewport ?? { x: 0, y: 0, zoom: 1 },
    stickers: Array.isArray(doc.stickers) ? doc.stickers.map(upgradeSticker) : [],
  }
}

/** 처음 스티커에는 앞/뒤 두 갈래(front)뿐이었다. 그 사이에 '본문 밑' 이 생겨 켜 이름으로 바뀌었다.
 *  투명도·흑백·오려내기·기준점도 나중에 붙은 것이라 없으면 기본값으로 채운다.
 *  기준점이 없던 시절의 좌표는 노트 좌상단에서 잰 것이므로 'nw' 로 읽으면 자리가 그대로다. */
function upgradeSticker(raw: unknown): Sticker {
  const s = raw as Record<string, unknown>
  return {
    ...(s as unknown as Sticker),
    layer: (s.layer as Sticker['layer']) ?? (s.front ? 'front' : 'behind'),
    anchor: (s.anchor as Sticker['anchor']) ?? 'nw',
    opacity: typeof s.opacity === 'number' ? s.opacity : 1,
    mono: Boolean(s.mono),
    mask: (s.mask as Sticker['mask']) ?? 'none',
  }
}

/** 옛 'clip' 노트를 지금 형태로 옮긴다.
 *  글자만 있던 것은 메모로, 그림이 있던 것은 이미지 노트로 간다. */
function upgradeNote(raw: unknown): Note | null {
  const note = raw as Record<string, unknown>
  if (!note || typeof note !== 'object') return null
  if (note.kind !== 'clip') return note as unknown as Note

  const payload = note.payload as { type?: string; text?: string; file?: string; naturalW?: number; naturalH?: number }
  const base = { ...note }
  delete base.payload

  if (payload?.type === 'image' && payload.file) {
    return {
      ...base,
      kind: 'image',
      title: (note.title as string) || '이미지',
      file: payload.file,
      naturalW: payload.naturalW ?? 0,
      naturalH: payload.naturalH ?? 0,
    } as Note
  }

  return {
    ...base,
    id: (note.id as string) || newId(),
    kind: 'memo',
    title: (note.title as string) || '메모',
    body: payload?.text ?? '',
  } as Note
}

export async function writeCanvas(path: string, doc: CanvasDoc): Promise<void> {
  await files.writeText(path, JSON.stringify(doc, null, 2))
}

/* ── 그림 ─────────────────────────────────────────────────────────────
   화면에 물릴 수 있는 URL 을 캐시한다. 키는 캔버스마다 다를 수 있으므로
   파일 경로까지 포함해 만든다. */

const urlCache = new Map<string, string>()

function extensionFor(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/webp') return 'webp'
  return 'png'
}

function mimeFor(key: string): string {
  if (/\.jpe?g$/i.test(key)) return 'image/jpeg'
  if (/\.gif$/i.test(key)) return 'image/gif'
  if (/\.webp$/i.test(key)) return 'image/webp'
  return 'image/png'
}

/** 그림을 캔버스 옆에 저장하고 본문에 남길 파일 이름을 돌려준다. */
export async function saveCanvasImage(
  canvasPath: string,
  bytes: Uint8Array,
  mime: string,
): Promise<string> {
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(mime)}`
  const target = imagePathOf(canvasPath, key)
  const base64 = bytesToBase64(bytes)

  await files.writeBinary(target, base64)
  // 방금 만든 그림은 바로 화면에 뜨므로 다시 읽지 않도록 미리 담아 둔다.
  urlCache.set(target, URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime })))
  return key
}

export async function canvasImageUrl(canvasPath: string, key: string): Promise<string | null> {
  // 이름이 이상하면 없는 그림으로 다룬다 — 노트는 "찾을 수 없습니다" 를 보여 주면 된다.
  let target: string
  try {
    target = imagePathOf(canvasPath, key)
  } catch {
    return null
  }
  const cached = urlCache.get(target)
  if (cached) return cached

  const base64 = await files.readBinary(target).catch(() => null)
  if (!base64) return null

  const url = URL.createObjectURL(base64ToBlob(base64, mimeFor(key)))
  urlCache.set(target, url)
  return url
}

export async function deleteCanvasImage(canvasPath: string, key: string): Promise<void> {
  // 우리가 만든 이름이 아니면 손대지 않는다. 여기가 남의 파일을 지울 수 있는 유일한 길이다.
  let target: string
  try {
    target = imagePathOf(canvasPath, key)
  } catch {
    return
  }
  const cached = urlCache.get(target)
  if (cached?.startsWith('blob:')) URL.revokeObjectURL(cached)
  urlCache.delete(target)
  await files.remove(target).catch(() => {})
}

/** 캔버스를 닫을 때 그 캔버스의 URL 들을 놓아준다. 오래 켜 두면 쌓이기 때문이다. */
export function releaseCanvasImages(canvasPath: string): void {
  const prefix = assetsDirOf(canvasPath)
  for (const [target, url] of urlCache) {
    if (!target.startsWith(prefix)) continue
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    urlCache.delete(target)
  }
}
