/** 노트에 붙어 있는 스티커와 그 노트를 잇는 선.
 *
 *  꾸미는 동안에만 보인다 — 평소에도 선이 그어져 있으면 보드가 지저분해지고,
 *  꾸미기를 그만두는 순간 스티커는 그냥 붙어 있는 그림이면 된다.
 *
 *  선 위에 커서를 올리면 가위가 되고, 누르면 끊어진다. 끊긴 스티커는 그때 보이던
 *  자리 그대로 캔버스 배경에 남는다(detachSticker 가 좌표를 옮겨 준다). */
import { useShallow } from 'zustand/react/shallow'
import { useBoard, worldOf } from '../store/boardStore'
import { useSettings } from '../store/settingsStore'
import './sticker.css'

export function StickerLinks() {
  const stickerIds = useBoard(useShallow((s) => s.stickerIds))
  const stickers = useBoard((s) => s.stickers)
  const notes = useBoard((s) => s.notes)
  const zoom = useBoard((s) => s.viewport.zoom)
  const assets = useSettings((s) => s.stickerAssets)

  const lines = stickerIds
    .map((id) => stickers[id])
    .filter((s) => s?.noteId && notes[s.noteId])
    .map((sticker) => {
      const note = notes[sticker.noteId as string]
      const from = worldOf(sticker, note)
      const to = { x: note.x + note.w / 2, y: note.y + note.h / 2 }
      const name = assets.find((a) => a.id === sticker.assetId)?.name ?? '스티커'
      return { id: sticker.id, from, to, name }
    })

  if (!lines.length) return null

  return (
    <>
      {lines.map((line) => (
        <Link key={line.id} {...line} zoom={zoom} />
      ))}
    </>
  )
}

function Link({
  id,
  from,
  to,
  name,
  zoom,
}: {
  id: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  name: string
  zoom: number
}) {
  const left = Math.min(from.x, to.x)
  const top = Math.min(from.y, to.y)
  // 선이 수직·수평이면 폭이나 높이가 0 이 되어 아무것도 안 보인다. 최소 한 겹은 준다.
  const width = Math.max(1, Math.abs(to.x - from.x))
  const height = Math.max(1, Math.abs(to.y - from.y))

  const x1 = from.x - left
  const y1 = from.y - top
  const x2 = to.x - left
  const y2 = to.y - top

  return (
    <svg className="stlink" style={{ left, top, width, height, overflow: 'visible' }}>
      <line className="stlink__line" x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={Math.max(1, 2 / zoom)} />
      {/* 실제로 누르는 자리. 선만으로는 너무 가늘어 잡히지 않으므로 굵게 깔아 둔다. */}
      <line
        className="stlink__hit"
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        strokeWidth={Math.max(10, 14 / zoom)}
        onClick={() => useBoard.getState().detachSticker(id)}
      >
        <title>{`${name} 연결 — 누르면 끊어집니다`}</title>
      </line>
    </svg>
  )
}
