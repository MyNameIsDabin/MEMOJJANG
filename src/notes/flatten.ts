/** 덧그린 획까지 한 장으로 굽는다.
 *
 *  획은 노트에 좌표로만 남고 원본 파일은 건드리지 않는다 — 그래야 한 획씩 되돌릴 수 있다.
 *  그래서 화면에서는 그림 위에 SVG 를 겹쳐 보여 주는데, 밖으로 내보낼 때(복사 같은)는
 *  겹쳐 보이던 그대로 한 장이어야 한다. 원본만 나가면 "그린 게 왜 없냐" 가 된다.
 *
 *  좌표를 그대로 쓸 수 있는 이유: 획을 담는 SVG 의 viewBox 가 곧 원본 픽셀이다. */
import type { Stroke } from '../types'
import { t } from '../i18n'

export async function flattenImage(
  url: string,
  strokes: Stroke[],
  width: number,
  height: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob())
  const canvas = document.createElement('canvas')
  // 노트가 아는 크기를 믿되, 없으면 그림에게 물어본다.
  canvas.width = width || bitmap.width
  canvas.height = height || bitmap.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error(t('err.pngConvert'))
  }

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const stroke of strokes) {
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.beginPath()
    for (let i = 0; i + 1 < stroke.points.length; i += 2) {
      if (i === 0) ctx.moveTo(stroke.points[i], stroke.points[i + 1])
      else ctx.lineTo(stroke.points[i], stroke.points[i + 1])
    }
    // 점 하나짜리 획도 같은 자리를 두 번 담고 있어, 둥근 끝 덕분에 점으로 찍힌다.
    ctx.stroke()
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t('err.pngConvert')))), 'image/png'),
  )
}
