/** 지금 보고 있는 캔버스에 딸린 그림을 다룬다.
 *
 *  노트 쪽 코드가 "어느 캔버스인지" 를 매번 들고 다니지 않아도 되도록,
 *  활성 캔버스 경로를 여기서 찾아 붙인다. */
import { useCanvases } from '../store/canvasStore'
import { canvasImageUrl, saveCanvasImage } from './canvasFile'
import { t } from '../i18n'

function activePath(): string | null {
  return useCanvases.getState().activePath()
}

export async function saveImage(bytes: Uint8Array, mime: string): Promise<string> {
  const path = activePath()
  if (!path) throw new Error(t('err.noCanvas'))
  return saveCanvasImage(path, bytes, mime)
}

export async function imageUrl(key: string): Promise<string | null> {
  const path = activePath()
  if (!path) return null
  return canvasImageUrl(path, key)
}

/* 그림을 한 장씩 지우는 길은 일부러 두지 않았다. 노트를 지웠다고 그림까지 바로 지우면
   Ctrl+Z 로 노트가 돌아와도 그림이 없다. 아무도 가리키지 않게 된 그림은
   canvasFile 의 sweepCanvasImages 가 캔버스를 다시 열 때 한꺼번에 치운다. */
