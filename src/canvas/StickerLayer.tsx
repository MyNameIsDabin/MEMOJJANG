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
import { STICKER_BASE_PX, type Note, type Sticker, type StickerAsset } from '../types'
import { useBoard, worldOf } from '../store/boardStore'
import { useSettings } from '../store/settingsStore'
import { useUi } from '../store/uiStore'
import { stickerUrl } from '../platform/stickers'
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

export function StickerLayer({ front }: { front: boolean }) {
  const ids = useBoard(useShallow((s) => s.stickerIds))

  return (
    <div className={`stickers ${front ? 'stickers--front' : 'stickers--back'}`}>
      {ids.map((id) => (
        <StickerView key={id} id={id} front={front} />
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

function StickerView({ id, front }: { id: string; front: boolean }) {
  const sticker = useBoard((s) => s.stickers[id])
  const note = useBoard((s) => (sticker?.noteId ? s.notes[sticker.noteId] : undefined))
  const asset = useSettings((s) => s.stickerAssets.find((a) => a.id === sticker?.assetId))
  const decorating = useUi((s) => s.decorating)
  const active = useUi((s) => s.activeStickerId === id)
  const url = useStickerUrl(asset?.file)
  const move = useRef<MoveState | null>(null)

  const onDown = (e: React.PointerEvent) => {
    if (!decorating || e.button !== 0) return
    e.stopPropagation()
    useUi.getState().pickSticker(id)
    move.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    const m = move.current
    if (!m || m.pointerId !== e.pointerId) return
    // 창 밖에서 손을 뗀 경우를 놓치지 않는다.
    if (e.buttons === 0) {
      move.current = null
      return
    }
    const { zoom } = useBoard.getState().viewport
    const dx = (e.clientX - m.lastX) / zoom
    const dy = (e.clientY - m.lastY) / zoom
    if (!m.moved && Math.abs(e.clientX - m.lastX) < 3 && Math.abs(e.clientY - m.lastY) < 3) return
    // 되돌리기 지점은 실제로 움직이기 시작할 때 한 번만 남긴다.
    if (!m.moved) useBoard.getState().commit()
    m.moved = true
    m.lastX = e.clientX
    m.lastY = e.clientY
    const cur = useBoard.getState().stickers[id]
    if (cur) useBoard.getState().patchSticker(id, { x: cur.x + dx, y: cur.y + dy })
  }

  const onUp = (e: React.PointerEvent) => {
    if (move.current?.pointerId !== e.pointerId) return
    move.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  // 자기 층이 아니면 그리지 않는다. 붙어 있지 않은 스티커는 늘 노트 뒤다.
  if (!sticker || !asset || Boolean(sticker.front && sticker.noteId) !== front) return null
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
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {url ? (
        <img className="sticker__img" src={url} alt={asset.name} draggable={false} />
      ) : (
        <span className="sticker__gone">{asset.name}</span>
      )}
    </div>
  )
}

/** 손잡이·연결선이 스티커의 어디에 붙는지 계산할 때 함께 쓴다. */
export function boxOf(sticker: Sticker, asset: StickerAsset, note: Note | undefined) {
  const at = worldOf(sticker, note)
  const { w, h } = sizeOf(asset)
  return { cx: at.x, cy: at.y, w: w * sticker.scale, h: h * sticker.scale }
}
