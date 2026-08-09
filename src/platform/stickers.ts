/** 스티커 보관함.
 *
 *  보관함은 캔버스가 아니라 **앱**에 딸린다. 한 번 담아 둔 스티커를 캔버스마다 다시
 *  넣을 이유가 없기 때문이다. 그림은 앱 데이터 폴더의 `stickers/` 에 복사해 두고,
 *  목록만 설정 파일에 남는다.
 *
 *  담을 때 큰 그림은 줄인다. 원본을 그대로 두면 파일만 무거워지는데, 스티커는 화면에서
 *  기껏해야 몇백 px 로 그려지므로 그 이상은 쓸 일이 없다. */
import { STICKER_MAX_BYTES, STICKER_MAX_PX, newId, type StickerAsset } from '../types'
import { files, baseName } from './files'
import { isTauri } from './env'
import { base64ToBlob } from '../utils/bytes'

const DIR = 'stickers'

/** 파일 이름 -> blob URL. 한 번 만든 것은 다시 쓴다. */
const urlCache = new Map<string, string>()

async function fs() {
  return import('@tauri-apps/plugin-fs')
}

/** 화면에 쓸 주소. 없으면 null. */
export async function stickerUrl(file: string): Promise<string | null> {
  const cached = urlCache.get(file)
  if (cached) return cached
  if (!isTauri()) return null

  const { readFile, BaseDirectory } = await fs()
  const bytes = await readFile(`${DIR}/${file}`, { baseDir: BaseDirectory.AppData }).catch(() => null)
  if (!bytes) return null

  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeFor(file) }))
  urlCache.set(file, url)
  return url
}

function mimeFor(name: string): string {
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg'
  if (/\.gif$/i.test(name)) return 'image/gif'
  if (/\.webp$/i.test(name)) return 'image/webp'
  return 'image/png'
}

/** 긴 변이 한계를 넘으면 줄인다. 넘지 않으면 원본 바이트를 그대로 쓴다 —
 *  다시 그리면 애니메이션 GIF 같은 것이 첫 장으로 납작해지기 때문이다. */
async function shrink(
  blob: Blob,
): Promise<{ bytes: Uint8Array; mime: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob)
  const long = Math.max(bitmap.width, bitmap.height)

  if (long <= STICKER_MAX_PX) {
    const buffer = await blob.arrayBuffer()
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return { bytes: new Uint8Array(buffer), mime: blob.type || 'image/png', ...size }
  }

  const ratio = STICKER_MAX_PX / long
  const width = Math.max(1, Math.round(bitmap.width * ratio))
  const height = Math.max(1, Math.round(bitmap.height * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('그림을 줄이지 못했습니다.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!out) throw new Error('그림을 줄이지 못했습니다.')
  return { bytes: new Uint8Array(await out.arrayBuffer()), mime: 'image/png', width, height }
}

/** 그림을 골라 보관함에 담는다. 고르지 않고 닫으면 null. */
export async function addStickerAsset(name: string): Promise<StickerAsset | null> {
  if (!isTauri()) throw new Error('앱에서만 스티커를 담을 수 있습니다.')

  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({
    multiple: false,
    filters: [{ name: '그림', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
  })
  if (typeof picked !== 'string') return null

  const base64 = await files.readBinary(picked)
  if (base64 === null) throw new Error('그림을 읽지 못했습니다.')

  const source = base64ToBlob(base64, mimeFor(picked))
  if (source.size > STICKER_MAX_BYTES) {
    throw new Error(`그림이 너무 큽니다 (${Math.round(STICKER_MAX_BYTES / 1024 / 1024)}MB 까지).`)
  }

  const { bytes, mime, width, height } = await shrink(source)
  const ext = mime === 'image/png' ? 'png' : mimeFor(picked).split('/')[1]
  const file = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { writeFile, mkdir, BaseDirectory } = await fs()
  const opts = { baseDir: BaseDirectory.AppData }
  await mkdir(DIR, { ...opts, recursive: true }).catch(() => {})
  await writeFile(`${DIR}/${file}`, bytes, opts)

  // 방금 담은 것은 곧바로 화면에 뜨므로 다시 읽지 않도록 미리 담아 둔다.
  urlCache.set(file, URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime })))

  return {
    id: newId(),
    name: name.trim() || baseName(picked).replace(/\.[^.]+$/, ''),
    file,
    naturalW: width,
    naturalH: height,
  }
}

export async function removeStickerAsset(asset: StickerAsset): Promise<void> {
  const url = urlCache.get(asset.file)
  if (url) URL.revokeObjectURL(url)
  urlCache.delete(asset.file)
  if (!isTauri()) return
  const { remove, BaseDirectory } = await fs()
  await remove(`${DIR}/${asset.file}`, { baseDir: BaseDirectory.AppData }).catch(() => {})
}
