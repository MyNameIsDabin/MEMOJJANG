/** 영역 캡처 화면.
 *
 *  창이 이미 바탕화면 전체를 덮고 있고, 그 위에 **얼려 둔 화면**이 깔려 있다.
 *  여기서 하는 일은 드래그로 사각형을 받아 그만큼 오려 내는 것뿐이다.
 *
 *  얼린 그림은 물리 픽셀, 창은 CSS 픽셀이라 배율이 다르다. 화면 배율이 150% 인
 *  컴퓨터에서 이걸 빠뜨리면 고른 자리보다 2/3 만큼만 잘린다. */
import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../store/settingsStore'
import { cropShot, endCapture, expandCapture, type Shot } from '../platform/capture'
import { addImageBlob } from '../actions/paste'
import { describeError, notify } from './toast'
import { useT } from '../i18n'
import './capture.css'

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** 실수로 딸깍한 것과 진짜로 고른 것을 가르는 문턱(CSS 픽셀). */
const MIN_SIZE = 6

export function CaptureOverlay({
  shot,
  world,
  onDone,
}: {
  shot: Shot
  world: { x: number; y: number }
  onDone: () => void
}) {
  const [rect, setRect] = useState<Rect | null>(null)
  const t = useT()
  const start = useRef<{ x: number; y: number } | null>(null)
  const busy = useRef(false)

  /** 창을 되돌리고 물러난다. 어떤 길로 끝나든 여기를 지나야 한다. */
  const leave = async () => {
    if (busy.current) return
    busy.current = true
    await endCapture(useSettings.getState().alwaysOnTop)
    URL.revokeObjectURL(shot.url)
    onDone()
  }

/* 얼린 그림을 다 그린 **뒤에** 창을 화면 전체로 넓힌다. 먼저 넓히면 그리기 전의
     보드가 화면 가득 늘어난 채로 한 번 번쩍인다 (begin_capture 쪽 설명 참고).

     rAF 를 두 번 겹치는 이유: 첫 번째 콜백은 아직 칠하기 **전**에 불린다.
     한 번 더 미뤄야 화면에 실제로 그림이 올라온 뒤가 된다. */
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => void expandCapture())
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      void leave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // leave 는 매 렌더마다 새로 만들어지지만 하는 일은 같다. 한 번만 걸어 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY }
    setRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 })
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    const from = start.current
    if (!from) return
    setRect({
      left: Math.min(from.x, e.clientX),
      top: Math.min(from.y, e.clientY),
      width: Math.abs(e.clientX - from.x),
      height: Math.abs(e.clientY - from.y),
    })
  }

  const onUp = async (e: React.PointerEvent) => {
    const from = start.current
    start.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!from || !rect) return

    // 너무 작으면 고른 게 아니라 잘못 누른 것으로 본다.
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
      setRect(null)
      return
    }

    if (busy.current) return
    busy.current = true
    try {
      // CSS 픽셀 -> 얼린 그림의 픽셀
      const scale = shot.width / window.innerWidth
      const blob = await cropShot({
        x: rect.left * scale,
        y: rect.top * scale,
        w: rect.width * scale,
        h: rect.height * scale,
      })
      // 노트를 만들기 전에 창부터 되돌린다 — 새 노트가 원래 화면에서 보여야 한다.
      await endCapture(useSettings.getState().alwaysOnTop)
      URL.revokeObjectURL(shot.url)
      onDone()
      await addImageBlob(blob, world)
    } catch (err) {
      console.error('[capture] 캡처 실패', err)
      await endCapture(useSettings.getState().alwaysOnTop)
      URL.revokeObjectURL(shot.url)
      onDone()
      notify(t('toast.cropFailed', { reason: describeError(err) }), 'error')
    }
  }

  return (
    <div
      className="capture"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={(e) => void onUp(e)}
      onPointerCancel={() => {
        start.current = null
        setRect(null)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        void leave()
      }}
    >
      <img className="capture__frozen" src={shot.url} alt="" draggable={false} />

      {/* 어둡게 깔되 고른 자리만 뚫어 준다. 네 조각으로 나눠 덮으면 구멍이 생긴다. */}
      {rect ? (
        <>
          <div className="capture__veil" style={{ left: 0, top: 0, right: 0, height: rect.top }} />
          <div
            className="capture__veil"
            style={{ left: 0, top: rect.top, width: rect.left, height: rect.height }}
          />
          <div
            className="capture__veil"
            style={{ left: rect.left + rect.width, top: rect.top, right: 0, height: rect.height }}
          />
          <div className="capture__veil" style={{ left: 0, top: rect.top + rect.height, right: 0, bottom: 0 }} />
          <div
            className="capture__rect"
            style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          >
            <span className="capture__size">
              {Math.round(rect.width)} × {Math.round(rect.height)}
            </span>
          </div>
        </>
      ) : (
        <div className="capture__veil" style={{ inset: 0 }} />
      )}

      {!rect && (
        <div className="capture__hint">
          <span>{t('capture.hint')}</span>
          <span className="capture__hintkey">{t('capture.exit')}</span>
        </div>
      )}
    </div>
  )
}
