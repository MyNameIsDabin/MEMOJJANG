/** 붙여넣은 그림 한 장. 스크린샷을 잠깐 얹어두는 자리다.
 *
 *  연필로 덧그릴 수 있다. 획은 **원본 파일을 건드리지 않고** 노트에 좌표로만 남는다.
 *  그래서 언제든 한 획씩 되돌릴 수 있고, 노트를 늘리거나 캔버스를 확대해도 그림과 함께 커진다. */
import { useEffect, useRef, useState } from 'react'
import { PEN_COLORS, PEN_SIZES, type ImageNote, type Stroke } from '../types'
import { imageChromeHeight, useBoard } from '../store/boardStore'
import { imageUrl } from '../platform/assets'
import { copyImageFromUrl } from '../platform/clipboard'
import { Icon } from '../ui/Icon'

export function ImageBody({ note }: { note: ImageNote }) {
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [copied, setCopied] = useState(false)

  const [drawing, setDrawing] = useState(false)
  const [color, setColor] = useState(PEN_COLORS[0])
  const [size, setSize] = useState(PEN_SIZES[1])
  /** 지금 긋고 있는 획. 손을 뗄 때 노트로 옮긴다. */
  const [pending, setPending] = useState<Stroke | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const active = useRef(false)

  const strokes = note.strokes ?? []
  // 굵기는 그림 크기에 견주어 정한다. 작은 아이콘과 큰 스크린샷에 같은 px 를 쓰면 한쪽이 우스워진다.
  const penWidth = Math.max(1, size * Math.max(note.naturalW, note.naturalH))

  useEffect(() => {
    let alive = true
    setMissing(false)
    imageUrl(note.file).then((resolved) => {
      if (!alive) return
      if (resolved) setUrl(resolved)
      else setMissing(true)
    })
    return () => {
      alive = false
    }
  }, [note.file])

  const onCopy = async () => {
    if (!url) return
    await copyImageFromUrl(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  /** 원본 비율로 되돌린다. 늘렸다가 찌그러졌을 때 쓴다. */
  const fitToImage = () => {
    if (!note.naturalW || !note.naturalH) return
    const height = Math.round((note.w * note.naturalH) / note.naturalW) + imageChromeHeight()
    useBoard.getState().resizeNote(note.id, note.w, height)
  }

  /* 화면 좌표를 원본 그림의 좌표로 옮긴다.
     SVG 의 viewBox 가 곧 원본 픽셀이라, 이 변환 하나면 노트 크기·캔버스 배율·여백을
     전부 한꺼번에 풀어 준다 — 직접 계산하면 object-fit 의 letterbox 에서 어긋난다. */
  const toImage = (e: React.PointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const point = svg.createSVGPoint()
    point.x = e.clientX
    point.y = e.clientY
    const at = point.matrixTransform(ctm.inverse())
    return { x: at.x, y: at.y }
  }

  const onDown = (e: React.PointerEvent) => {
    if (!drawing || e.button !== 0) return
    const at = toImage(e)
    if (!at) return
    e.stopPropagation()
    active.current = true
    setPending({ color, width: penWidth, points: [at.x, at.y] })
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    if (!active.current) return
    const at = toImage(e)
    if (!at) return
    setPending((cur) => {
      if (!cur) return cur
      // 너무 촘촘한 점은 버린다. 그대로 다 담으면 획 하나가 수백 점이 되어 파일만 커진다.
      const n = cur.points.length
      const dx = at.x - cur.points[n - 2]
      const dy = at.y - cur.points[n - 1]
      if (dx * dx + dy * dy < 4) return cur
      return { ...cur, points: [...cur.points, at.x, at.y] }
    })
  }

  const onUp = (e: React.PointerEvent) => {
    if (!active.current) return
    active.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)

    const stroke = pending
    setPending(null)
    // 점 하나뿐이면 딸깍한 것이다. 그래도 점은 찍히도록 같은 자리를 한 번 더 넣어 준다.
    if (!stroke) return
    const points = stroke.points.length >= 4 ? stroke.points : [...stroke.points, ...stroke.points]

    // 획 하나가 되돌리기 한 칸이 된다.
    useBoard.getState().commit()
    useBoard.getState().patchNote(note.id, { strokes: [...strokes, { ...stroke, points }] })
  }

  const undo = () => {
    if (!strokes.length) return
    useBoard.getState().commit()
    useBoard.getState().patchNote(note.id, { strokes: strokes.slice(0, -1) })
  }

  const clear = () => {
    if (!strokes.length) return
    useBoard.getState().commit()
    useBoard.getState().patchNote(note.id, { strokes: [] })
  }

  const shown = pending ? [...strokes, pending] : strokes

  return (
    <div className="imagenote">
      <div className="imagenote__frame">
        {missing ? (
          <div className="imagenote__missing">
            그림 파일을 찾을 수 없습니다.
            <br />
            캔버스 파일만 옮기고 <b>.assets</b> 폴더를 두고 오지 않았는지 확인해 보세요.
          </div>
        ) : url ? (
          <img src={url} alt={note.title} draggable={false} />
        ) : null}

        {/* viewBox 가 원본 픽셀이고 meet 이라, 밑에 깔린 object-fit: contain 그림과 자리가 정확히 겹친다. */}
        {!missing && note.naturalW > 0 && note.naturalH > 0 && (
          <svg
            ref={svgRef}
            className={`imagenote__ink${drawing ? ' imagenote__ink--on' : ''}`}
            viewBox={`0 0 ${note.naturalW} ${note.naturalH}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            {shown.map((stroke, i) => (
              <polyline
                key={i}
                points={pairs(stroke.points)}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        )}
      </div>

      <div className="imagenote__foot">
        <button type="button" className="imagenote__act" onClick={fitToImage} title="원본 비율로 맞추기">
          {note.naturalW}×{note.naturalH}
        </button>

        {drawing && (
          <span className="pen">
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`pen__color${c === color ? ' pen__color--on' : ''}`}
                style={{ background: c }}
                title="펜 색"
                onClick={() => setColor(c)}
              />
            ))}
            {PEN_SIZES.map((s, i) => (
              <button
                key={s}
                type="button"
                className={`pen__size${s === size ? ' pen__size--on' : ''}`}
                title={['얇게', '보통', '굵게'][i]}
                onClick={() => setSize(s)}
              >
                <span style={{ width: 3 + i * 3, height: 3 + i * 3 }} />
              </button>
            ))}
            <button type="button" className="imagenote__act" onClick={undo} disabled={!strokes.length}>
              한 획 지우기
            </button>
            <button type="button" className="imagenote__act" onClick={clear} disabled={!strokes.length}>
              모두
            </button>
          </span>
        )}

        <span className="imagenote__gap" />

        <button
          type="button"
          className="imagenote__act"
          aria-pressed={drawing}
          title="연필로 덧그리기 — 원본 파일은 그대로 둡니다"
          onClick={() => setDrawing((v) => !v)}
        >
          <Icon name="pencil" />
        </button>
        <button type="button" className="imagenote__act" onClick={onCopy} disabled={!url}>
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
    </div>
  )
}

function pairs(points: number[]): string {
  const out: string[] = []
  for (let i = 0; i + 1 < points.length; i += 2) out.push(`${round(points[i])},${round(points[i + 1])}`)
  return out.join(' ')
}

/** 소수점을 한 자리로 줄인다. 화면에서는 차이가 없고 파일만 훨씬 가벼워진다. */
const round = (v: number) => Math.round(v * 10) / 10
