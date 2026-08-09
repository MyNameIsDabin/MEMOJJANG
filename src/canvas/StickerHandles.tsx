/** 고른 스티커에 붙는 손잡이들.
 *
 *  네 귀퉁이는 하나로 돌리기와 키우기를 함께 한다 — 귀퉁이가 커서를 따라오게 두면
 *  중심에서의 **거리**가 크기가 되고 **각도**가 회전이 된다. 손이 가는 대로 움직이므로
 *  둘을 따로 배우지 않아도 된다. 회전이 거슬릴 때는 Shift 로 각도를 붙잡는다.
 *
 *  손잡이는 캔버스 배율을 거슬러 키운다(1/zoom). 안 그러면 축소해 놓고 볼 때
 *  손잡이가 몇 픽셀로 쪼그라들어 잡을 수가 없다. */
import { useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { STICKER_ANCHORS, STICKER_MAX_SCALE, STICKER_MIN_SCALE, type StickerAnchor } from '../types'
import { toWorld, useBoard, worldOf } from '../store/boardStore'
import { useSettings } from '../store/settingsStore'
import { Icon } from '../ui/Icon'
import { sizeOf } from './StickerLayer'

const CORNERS = [
  { key: 'nw', sx: -1, sy: -1 },
  { key: 'ne', sx: 1, sy: -1 },
  { key: 'se', sx: 1, sy: 1 },
  { key: 'sw', sx: -1, sy: 1 },
] as const

interface Transform {
  pointerId: number
  /** 잡은 순간의 중심→커서 각도(라디안)와 거리 */
  angle: number
  distance: number
  startRotation: number
  startScale: number
}

export function StickerHandles({ id }: { id: string }) {
  const sticker = useBoard((s) => s.stickers[id])
  const note = useBoard((s) => (sticker?.noteId ? s.notes[sticker.noteId] : undefined))
  const asset = useSettings((s) => s.stickerAssets.find((a) => a.id === sticker?.assetId))
  const zoom = useBoard((s) => s.viewport.zoom)

  const transform = useRef<Transform | null>(null)
  /** 연결하려고 끌고 있는 중의 커서 자리(월드 좌표). */
  const [linkTo, setLinkTo] = useState<{ x: number; y: number } | null>(null)

  if (!sticker || !asset) return null
  if (sticker.noteId && !note) return null

  const at = worldOf(sticker, note)
  const base = sizeOf(asset)
  const w = base.w * sticker.scale
  const h = base.h * sticker.scale
  /** 손잡이 크기는 화면에서 늘 같아 보이도록 배율을 되돌린다. */
  const k = 1 / zoom

  const center = () => {
    const cur = useBoard.getState()
    const s = cur.stickers[id]
    if (!s) return { x: 0, y: 0 }
    return worldOf(s, s.noteId ? cur.notes[s.noteId] : undefined)
  }

  const beginTransform = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const c = center()
    const p = toWorld(useBoard.getState().viewport, e.clientX, e.clientY)
    const dx = p.x - c.x
    const dy = p.y - c.y
    useBoard.getState().commit()
    transform.current = {
      pointerId: e.pointerId,
      angle: Math.atan2(dy, dx),
      // 0 이면 나눗셈이 터진다. 중심을 정확히 집는 일은 드물지만 막아 둔다.
      distance: Math.max(1e-3, Math.hypot(dx, dy)),
      startRotation: sticker.rotation,
      startScale: sticker.scale,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onTransformMove = (e: React.PointerEvent) => {
    const t = transform.current
    if (!t || t.pointerId !== e.pointerId) return
    if (e.buttons === 0) {
      transform.current = null
      return
    }
    const c = center()
    const p = toWorld(useBoard.getState().viewport, e.clientX, e.clientY)
    const dx = p.x - c.x
    const dy = p.y - c.y
    const distance = Math.max(1e-3, Math.hypot(dx, dy))

    const scale = Math.min(
      STICKER_MAX_SCALE,
      Math.max(STICKER_MIN_SCALE, (t.startScale * distance) / t.distance),
    )
    const rotation = e.shiftKey
      ? t.startRotation
      : t.startRotation + ((Math.atan2(dy, dx) - t.angle) * 180) / Math.PI

    useBoard.getState().patchSticker(id, { scale, rotation: Math.round(rotation) })
  }

  const endTransform = (e: React.PointerEvent) => {
    if (transform.current?.pointerId !== e.pointerId) return
    transform.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  /* 연결: 손잡이에서 노트로 끌어다 놓는다. 끄는 동안 노트마다 받는 자리가 나타난다
     (StickerLinks 가 그린다). 놓은 자리 밑에 그 표식이 있으면 거기에 붙인다. */
  const beginLink = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const p = toWorld(useBoard.getState().viewport, e.clientX, e.clientY)
    setLinkTo(p)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onLinkMove = (e: React.PointerEvent) => {
    if (!linkTo) return
    setLinkTo(toWorld(useBoard.getState().viewport, e.clientX, e.clientY))
  }

  const endLink = (e: React.PointerEvent) => {
    if (!linkTo) return
    setLinkTo(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)

    // 포인터를 붙잡고 있으면 그 밑의 요소는 elementFromPoint 로 찾아야 한다.
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-note-target]')
    const target = under?.getAttribute('data-note-target')
    if (!target) return
    const anchor = (under?.getAttribute('data-anchor') as StickerAnchor | null) ?? 'center'
    useBoard.getState().attachSticker(id, target, anchor)
  }

  const linking = linkTo !== null

  return (
    <>
      {linking && (
        <>
          <NoteTargets />
          <LinkPreview from={at} to={linkTo} />
        </>
      )}

      <div
        className="sthandles"
        style={{
          left: at.x,
          top: at.y,
          width: w,
          height: h,
          transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
        }}
      >
        <div className="sthandles__frame" style={{ outlineWidth: Math.max(1, 2 * k) }} />

        {CORNERS.map((corner) => (
          <button
            key={corner.key}
            type="button"
            className="sthandles__grip"
            title="끌어서 돌리고 키웁니다 (Shift: 크기만)"
            style={{
              width: 14 * k,
              height: 14 * k,
              left: `calc(50% + ${(corner.sx * w) / 2}px)`,
              top: `calc(50% + ${(corner.sy * h) / 2}px)`,
              marginLeft: -7 * k,
              marginTop: -7 * k,
              borderWidth: Math.max(1, 2 * k),
            }}
            onPointerDown={beginTransform}
            onPointerMove={onTransformMove}
            onPointerUp={endTransform}
            onPointerCancel={endTransform}
          />
        ))}
      </div>

      {/* 이어 붙이는 손잡이만 스티커 곁에 남긴다 — 여기서 저기로 끄는 몸짓 자체가 뜻이라서다.
          나머지 손보기는 화면 아래 도구 줄(StickerBar)이 맡는다. */}
      <button
        type="button"
        className="stlinker"
        title="메모 위에 연결해 붙일 수 있어요"
        style={{
          left: at.x - w / 2,
          top: at.y + h / 2,
          width: 26 * k,
          height: 26 * k,
          marginLeft: -13 * k,
          marginTop: -13 * k,
          borderWidth: Math.max(1, 2 * k),
        }}
        onPointerDown={beginLink}
        onPointerMove={onLinkMove}
        onPointerUp={endLink}
        onPointerCancel={endLink}
      >
        <Icon name="link" />
      </button>
    </>
  )
}

/** 끄는 동안 따라다니는 선. 노트에 붙은 뒤의 선은 StickerLinks 가 그린다.
 *  viewBox 를 두지 않으므로 SVG 안의 좌표가 곧 화면 픽셀이다 — 선 굵기가 늘어나지 않는다. */
function LinkPreview({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const zoom = useBoard((s) => s.viewport.zoom)
  const left = Math.min(from.x, to.x)
  const top = Math.min(from.y, to.y)

  return (
    <svg
      className="stlink stlink--preview"
      style={{ left, top, width: Math.abs(to.x - from.x) || 1, height: Math.abs(to.y - from.y) || 1 }}
    >
      <line
        x1={from.x - left}
        y1={from.y - top}
        x2={to.x - left}
        y2={to.y - top}
        strokeWidth={Math.max(1, 2 / zoom)}
      />
    </svg>
  )
}

/** 끄는 동안 노트마다 나타나는 받는 자리.
 *
 *  네 모서리와 가운데, 다섯 곳이다. 어디에 놓느냐가 곧 **기준점**이 되고,
 *  노트 크기가 바뀌면 스티커가 그 자리를 따라 움직인다. 오른쪽 아래에 매달아 두면
 *  노트를 늘려도 늘 오른쪽 아래에 남는다. */
function NoteTargets() {
  const noteIds = useBoard(useShallow((s) => s.noteIds))
  const notes = useBoard((s) => s.notes)
  const zoom = useBoard((s) => s.viewport.zoom)
  const k = 1 / zoom

  return (
    <>
      {noteIds.flatMap((noteId) => {
        const n = notes[noteId]
        if (!n) return []
        return STICKER_ANCHORS.map((spot) => {
          const fx = spot.value === 'ne' || spot.value === 'se' ? 1 : spot.value === 'center' ? 0.5 : 0
          const fy = spot.value === 'sw' || spot.value === 'se' ? 1 : spot.value === 'center' ? 0.5 : 0
          const big = spot.value === 'center'
          const size = (big ? 30 : 22) * k
          return (
            <div
              key={`${noteId}:${spot.value}`}
              className={`sttarget${big ? '' : ' sttarget--corner'}`}
              data-note-target={noteId}
              data-anchor={spot.value}
              title={`${n.title} — ${spot.hint}`}
              style={{
                left: n.x + n.w * fx,
                top: n.y + n.h * fy,
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderWidth: Math.max(1, 2 * k),
              }}
            >
              {big && <Icon name="link" />}
            </div>
          )
        })
      })}
    </>
  )
}
