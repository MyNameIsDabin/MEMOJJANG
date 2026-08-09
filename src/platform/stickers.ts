/** 스티커 보관함.
 *
 *  보관함은 캔버스가 아니라 **앱**에 딸린다. 한 번 담아 둔 스티커를 캔버스마다 다시
 *  넣을 이유가 없기 때문이다. 그림은 앱 데이터 폴더의 `stickers/` 에 복사해 두고,
 *  목록만 설정 파일에 남는다.
 *
 *  담을 때 큰 그림은 줄인다. 원본을 그대로 두면 파일만 무거워지는데, 스티커는 화면에서
 *  기껏해야 몇백 px 로 그려지므로 그 이상은 쓸 일이 없다. */
import {
  STICKER_MAX_BYTES,
  STICKER_MAX_PX,
  STICKER_PACK_EXT,
  STICKER_PACK_VERSION,
  newId,
  type StickerAsset,
  type StickerPack,
} from '../types'
import { files, baseName } from './files'
import { isTauri } from './env'
import { base64ToBlob, base64ToBytes, bytesToBase64 } from '../utils/bytes'

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

/** 꾸러미에 적힌 크기를 쓸 만한 값으로 가둔다. */
function size(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
  return Math.min(4096, Math.max(1, n || 128))
}

/** 고른 스티커들을 꾸러미 파일 하나로 내보낸다. 저장을 취소하면 false. */
export async function exportStickerPack(assets: StickerAsset[]): Promise<boolean> {
  if (!isTauri()) throw new Error('앱에서만 내보낼 수 있습니다.')
  if (!assets.length) throw new Error('내보낼 스티커를 골라 주세요.')

  const { save } = await import('@tauri-apps/plugin-dialog')
  const path = await save({
    title: '스티커 꾸러미 내보내기',
    defaultPath: `스티커 꾸러미.${STICKER_PACK_EXT}`,
    filters: [{ name: '메모짱 스티커 꾸러미', extensions: [STICKER_PACK_EXT] }],
  })
  if (!path) return false

  const { readFile, BaseDirectory } = await fs()
  const packed: StickerPack['stickers'] = []

  for (const asset of assets) {
    const bytes = await readFile(`${DIR}/${asset.file}`, { baseDir: BaseDirectory.AppData }).catch(
      () => null,
    )
    // 그림이 사라진 스티커는 담아 봐야 받는 쪽에서 못 쓴다. 조용히 건너뛴다.
    if (!bytes) continue
    packed.push({
      name: asset.name,
      mime: mimeFor(asset.file),
      data: bytesToBase64(bytes),
      naturalW: asset.naturalW,
      naturalH: asset.naturalH,
    })
  }

  if (!packed.length) throw new Error('담을 그림이 없습니다.')

  const pack: StickerPack = {
    format: 'memojjang-stickers',
    version: STICKER_PACK_VERSION,
    stickers: packed,
  }
  await files.writeText(path, JSON.stringify(pack))
  return true
}

/** 꾸러미를 읽어 보관함에 더한다. 고르지 않고 닫으면 빈 배열. */
export async function importStickerPack(): Promise<StickerAsset[]> {
  if (!isTauri()) throw new Error('앱에서만 불러올 수 있습니다.')

  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({
    multiple: false,
    filters: [{ name: '메모짱 스티커 꾸러미', extensions: [STICKER_PACK_EXT, 'json'] }],
  })
  if (typeof picked !== 'string') return []

  const text = await files.readText(picked)
  if (text === null) throw new Error('파일을 읽지 못했습니다.')

  let pack: StickerPack
  try {
    pack = JSON.parse(text) as StickerPack
  } catch {
    throw new Error('스티커 꾸러미 파일이 아닙니다.')
  }
  if (pack?.format !== 'memojjang-stickers' || !Array.isArray(pack.stickers)) {
    throw new Error('스티커 꾸러미 파일이 아닙니다.')
  }

  const { writeFile, mkdir, BaseDirectory } = await fs()
  const opts = { baseDir: BaseDirectory.AppData }
  await mkdir(DIR, { ...opts, recursive: true }).catch(() => {})

  const added: StickerAsset[] = []
  for (const item of pack.stickers) {
    if (typeof item?.data !== 'string') continue
    const bytes = base64ToBytes(item.data)
    const ext = (item.mime ?? '').split('/')[1] || 'png'
    // 파일 이름은 여기서 새로 짓는다. 남의 이름을 그대로 쓰면 이미 있던 것을 덮어쓴다.
    const file = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    await writeFile(`${DIR}/${file}`, bytes, opts)
    urlCache.set(file, URL.createObjectURL(new Blob([bytes as BlobPart], { type: item.mime })))
    added.push({
      id: newId(),
      name: (item.name ?? '').trim().slice(0, 40) || '스티커',
      file,
      // 남이 만든 꾸러미의 숫자다. 말도 안 되는 값이 들어오면 화면 계산이 통째로 어그러진다.
      naturalW: size(item.naturalW),
      naturalH: size(item.naturalH),
    })
  }

  if (!added.length) throw new Error('꾸러미 안에 쓸 수 있는 스티커가 없습니다.')
  return added
}

export async function removeStickerAsset(asset: StickerAsset): Promise<void> {
  const url = urlCache.get(asset.file)
  if (url) URL.revokeObjectURL(url)
  urlCache.delete(asset.file)
  if (!isTauri()) return
  const { remove, BaseDirectory } = await fs()
  await remove(`${DIR}/${asset.file}`, { baseDir: BaseDirectory.AppData }).catch(() => {})
}
