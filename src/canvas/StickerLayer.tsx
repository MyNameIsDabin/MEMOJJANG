/** 캔버스에 붙여 놓은 스티커를 그린다.
 *
 *  자리는 전부 월드 좌표라서 이 레이어는 `.board__world` 안에 들어간다 — 캔버스를 옮기면
 *  스티커도 함께 따라간다. 노트에 붙어 있는 스티커는 그 노트를 기준으로 자리를 잡으므로
 *  노트를 끌면 저절로 같이 움직인다. 따로 따라다니게 하는 코드가 없다.
 *
 *  겹침 순서는 층을 나눠서 정한다. 노트의 z 는 계속 커지기만 하므로 스티커에 z 를 매겨
 *  다투게 하면 언젠가 진다. 그래서 '노트보다 뒤' 와 '노트보다 앞' 두 층을 아예 따로 둔다. */
import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  STICKER_BASE_PX,
  type Note,
  type Sticker,
  type StickerAsset,
  type StickerLayer as StickerLayerName,
} from '../types'
import { anchorFactors, useBoard, worldOf } from '../store/boardStore'
import { useSettings } from '../store/settingsStore'
import { useUi } from '../store/uiStore'
import { stickerUrl } from '../platform/stickers'
import { FitImage, useCanvasScale } from '../ui/FitImage'
import './sticker.css'

/** 기본 크기 — 긴 변이 STICKER_BASE_PX 가 되도록 맞춘다. */
export function sizeOf(asset: StickerAsset): { w: number; h: number } {
  const long = Math.max(asset.naturalW, asset.naturalH) || 1
  return {
    w: (asset.naturalW / long) * STICKER_BASE_PX,
    h: (asset.naturalH / long) * STICKER_BASE_PX,
  }
}

/** 그림 파일을 blob 주소로 바꿔 들고 있는다. 없는 파일이면 null. */
export function useStickerUrl(file: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }
    let alive = true
    void stickerUrl(file).then((u) => {
      if (alive) setUrl(u)
    })
    return () => {
      alive = false
    }
  }, [file])
  return url
}

/** 실제로 그려질 켜. 붙어 있지 않은 스티커에는 '본문 밑' 이 있을 수 없다. */
export function layerOf(sticker: Sticker): StickerLayerName {
  if (!sticker.noteId && sticker.layer === 'body') return 'behind'
  return sticker.layer
}

/** 오려내기 틀. 별은 꼭짓점 열 개를 직접 찍었다 — clip-path 에 별 모양이 따로 없다. */
const MASKS: Record<Sticker['mask'], string | undefined> = {
  none: undefined,
  circle: 'circle(50% at 50% 50%)',
  star: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
}

/** 스티커 그림에 얹는 꾸밈 — 투명도·흑백·오려내기. 노트 안쪽에 깔 때도 같은 것을 쓴다. */
export function paintOf(sticker: Sticker): React.CSSProperties {
  return {
    opacity: sticker.opacity,
    filter: sticker.mono ? 'grayscale(1)' : undefined,
    clipPath: MASKS[sticker.mask],
  }
}

export function StickerLayer({ layer }: { layer: StickerLayerName }) {
  const ids = useBoard(useShallow((s) => s.stickerIds))

  return (
    <div className={`stickers stickers--${layer}`}>
      {ids.map((id) => (
        <StickerView key={id} id={id} layer={layer} />
      ))}
    </div>
  )
}

interface MoveState {
  pointerId: number
  lastX: number
  lastY: number
  moved: boolean
}

/** 스티커를 골라 끄는 손놀림. 캔버스 위에 놓인 것과 노트 안쪽에 깔린 것이 똑같이 움직여야 하므로
 *  한 군데 모아 두고 둘이 나눠 쓴다. 꾸미는 중이 아니면 아무 손잡이도 내주지 않는다. */
function useStickerDrag(id: string) {
  const decorating = useUi((s) => s.decorating)
  const move = useRef<MoveState | null>(null)

  if (!decorating) return {}

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      useUi.getState().pickSticker(id)
      move.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY, moved: false }
      e.currentTarget.setPointerCapture(e.pointerId)
    },

    onPointerMove: (e: React.PointerEvent) => {
      const m = move.current
      if (!m || m.pointerId !== e.pointerId) return
      // 창 밖에서 손을 뗀 경우를 놓치지 않는다.
      if (e.buttons === 0) {
        move.current = null
        return
      }
      if (!m.moved && Math.abs(e.clientX - m.lastX) < 3 && Math.abs(e.clientY - m.lastY) < 3) return
      // 되돌리기 지점은 실제로 움직이기 시작할 때 한 번만 남긴다.
      if (!m.moved) useBoard.getState().commit()
      m.moved = true

      const { zoom } = useBoard.getState().viewport
      const dx = (e.clientX - m.lastX) / zoom
      const dy = (e.clientY - m.lastY) / zoom
      m.lastX = e.clientX
      m.lastY = e.clientY
      const cur = useBoard.getState().stickers[id]
      if (cur) useBoard.getState().patchSticker(id, { x: cur.x + dx, y: cur.y + dy })
    },

    onPointerUp: (e: React.PointerEvent) => {
      if (move.current?.pointerId !== e.pointerId) return
      move.current = null
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    },

    onPointerCancel: () => {
      move.current = null
    },
  }
}

function StickerView({ id, layer }: { id: string; layer: StickerLayerName }) {
  const sticker = useBoard((s) => s.stickers[id])
  const note = useBoard((s) => (sticker?.noteId ? s.notes[sticker.noteId] : undefined))
  const asset = useSettings((s) => s.stickerAssets.find((a) => a.id === sticker?.assetId))
  const decorating = useUi((s) => s.decorating)
  const active = useUi((s) => s.activeStickerId === id)
  const url = useStickerUrl(asset?.file)
  const handlers = useStickerDrag(id)
  const zoom = useCanvasScale()

  // 자기 켜가 아니면 그리지 않는다. '본문 밑' 은 노트가 직접 그린다(NoteShell).
  if (!sticker || !asset || layerOf(sticker) !== layer) return null
  // 붙어 있어야 할 노트가 없으면 그릴 자리도 없다. hydrate 가 정리해 주지만 지우는 순간에도 만난다.
  if (sticker.noteId && !note) return null

  const at = worldOf(sticker, note)
  const { w, h } = sizeOf(asset)

  return (
    <div
      className={`sticker${active ? ' sticker--on' : ''}${decorating ? ' sticker--live' : ''}`}
      data-sticker={id}
      style={{
        left: at.x,
        top: at.y,
        width: w,
        height: h,
        transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
      }}
      {...handlers}
    >
      {url ? (
        <FitImage
          className="sticker__img"
          src={url}
          alt={asset.name}
          draggable={false}
          scale={zoom * sticker.scale}
          style={paintOf(sticker)}
        />
      ) : (
        <span className="sticker__gone">{asset.name}</span>
      )}
    </div>
  )
}

/** 노트 안쪽(본문 밑)에 깔리는 스티커들. NoteShell 이 자기 안에 그린다.
 *
 *  기준점은 저장된 w·h 가 아니라 **실제로 그려진 크기**에서 잰다. 화면 가득 펼친 노트는
 *  자리와 크기를 CSS 가 정하므로 저장된 값과 전혀 다르고, 그대로 쓰면 스티커만 옛 자리에 남는다. */
export function NoteStickers({ noteId }: { noteId: string }) {
  const ids = useBoard(useShallow((s) => s.stickerIds))
  const stickers = useBoard((s) => s.stickers)
  const assets = useSettings((s) => s.stickerAssets)

  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const mine = ids
    .map((id) => stickers[id])
    .filter((s) => s?.noteId === noteId && layerOf(s) === 'body')

  // 스티커가 없어도 자리는 남겨 둔다 — 여기를 재야 나중에 붙는 스티커도 제자리에 온다.
  return (
    <div className="note__deco" ref={ref}>
      {box.w > 0 &&
        mine.map((sticker) => (
          <NoteSticker
            key={sticker.id}
            sticker={sticker}
            box={box}
            asset={assets.find((a) => a.id === sticker.assetId)}
          />
        ))}
    </div>
  )
}

function NoteSticker({
  sticker,
  asset,
  box,
}: {
  sticker: Sticker
  asset: StickerAsset | undefined
  box: { w: number; h: number }
}) {
  const url = useStickerUrl(asset?.file)
  const zoom = useCanvasScale()
  const active = useUi((s) => s.activeStickerId === sticker.id)
  const decorating = useUi((s) => s.decorating)
  const handlers = useStickerDrag(sticker.id)

  if (!asset || !url) return null
  const { w, h } = sizeOf(asset)
  const { fx, fy } = anchorFactors(sticker.anchor)

  return (
    <div
      className={`sticker sticker--inset${active ? ' sticker--on' : ''}${decorating ? ' sticker--live' : ''}`}
      style={{
        left: box.w * fx + sticker.x,
        top: box.h * fy + sticker.y,
        width: w,
        height: h,
        transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
      }}
      {...handlers}
    >
      <FitImage
        className="sticker__img"
        src={url}
        alt=""
        draggable={false}
        scale={zoom * sticker.scale}
        style={paintOf(sticker)}
      />
    </div>
  )
}

/** 손잡이·연결선이 스티커의 어디에 붙는지 계산할 때 함께 쓴다. */
export function boxOf(sticker: Sticker, asset: StickerAsset, note: Note | undefined) {
  const at = worldOf(sticker, note)
  const { w, h } = sizeOf(asset)
  return { cx: at.x, cy: at.y, w: w * sticker.scale, h: h * sticker.scale }
}
