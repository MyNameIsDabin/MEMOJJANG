/** 노트에 붙어 있는 스티커와 그 노트를 잇는 선.
 *
 *  꾸미는 동안에만 보인다 — 평소에도 선이 그어져 있으면 보드가 지저분해지고,
 *  꾸미기를 그만두는 순간 스티커는 그냥 붙어 있는 그림이면 된다.
 *
 *  선 위에 커서를 올리면 가위가 되고, 누르면 끊어진다. 끊긴 스티커는 그때 보이던
 *  자리 그대로 캔버스 배경에 남는다(detachSticker 가 좌표를 옮겨 준다). */
import { useShallow } from 'zustand/react/shallow'
import { anchorPointOf, useBoard, worldOf } from '../store/boardStore'
import { layerOf, sizeOf } from './StickerLayer'
import { useSettings } from '../store/settingsStore'
import './sticker.css'

/** 노트 뒤에 놓인 스티커의 자리를 알려 주는 실루엣.
 *
 *  뒤에 깔린 스티커는 노트에 가려 어디 있는지 보이지 않는다. 꾸미는 동안 노트는 잠겨
 *  이벤트를 그냥 흘려보내므로 **누르는 것은 이미 되는데**, 눈에 보이지 않아 누를 엄두를
 *  못 낼 뿐이다. 그래서 자리만 윤곽으로 띄운다 — 누르는 건 아래 진짜 스티커가 받는다. */
export function StickerSilhouettes() {
  const stickerIds = useBoard(useShallow((s) => s.stickerIds))
  const stickers = useBoard((s) => s.stickers)
  const notes = useBoard((s) => s.notes)
  const zoom = useBoard((s) => s.viewport.zoom)
  const assets = useSettings((s) => s.stickerAssets)

  return (
    <>
      {stickerIds.map((id) => {
        const sticker = stickers[id]
        if (!sticker || layerOf(sticker) !== 'behind') return null
        const asset = assets.find((a) => a.id === sticker.assetId)
        if (!asset) return null
        const note = sticker.noteId ? notes[sticker.noteId] : undefined
        if (sticker.noteId && !note) return null

        const at = worldOf(sticker, note)
        const { w, h } = sizeOf(asset)
        return (
          <div
            key={id}
            className="stghost"
            style={{
              left: at.x,
              top: at.y,
              width: w,
              height: h,
              transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
              // 배율과 스티커 크기를 되돌려야 화면에서 늘 같은 굵기로 보인다.
              borderWidth: Math.max(1, 2 / (zoom * sticker.scale)),
            }}
          />
        )
      })}
    </>
  )
}

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
      // 선은 실제로 매달린 자리로 간다. 늘 한가운데로 그으면 어느 모서리를 기준으로
      // 잡아 뒀는지 선만 봐서는 알 수 없다 — 노트를 늘렸을 때 어디로 따라갈지도 함께 읽힌다.
      const to = anchorPointOf(note, sticker.anchor)
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
