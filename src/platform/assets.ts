/** 지금 보고 있는 캔버스에 딸린 그림을 다룬다.
 *
 *  노트 쪽 코드가 "어느 캔버스인지" 를 매번 들고 다니지 않아도 되도록,
 *  활성 캔버스 경로를 여기서 찾아 붙인다. */
import { useCanvases } from '../store/canvasStore'
import { canvasImageUrl, deleteCanvasImage, saveCanvasImage } from './canvasFile'

function activePath(): string | null {
  return useCanvases.getState().activePath()
}

export async function saveImage(bytes: Uint8Array, mime: string): Promise<string> {
  const path = activePath()
  if (!path) throw new Error('열려 있는 캔버스가 없습니다.')
  return saveCanvasImage(path, bytes, mime)
}

export async function imageUrl(key: string): Promise<string | null> {
  const path = activePath()
  if (!path) return null
  return canvasImageUrl(path, key)
}

export async function deleteImage(key: string): Promise<void> {
  const path = activePath()
  if (!path) return
  await deleteCanvasImage(path, key)
}
