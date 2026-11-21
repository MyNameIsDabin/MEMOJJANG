/** 글칸(textarea) 안에서 찾은 글자를 보여 주기.
 *
 *  textarea 는 글자마다 어디 놓였는지 알려 주지 않고, 안쪽 글자에 칠을 할 수도 없다.
 *  그래서 같은 글꼴·폭·줄바꿈 규칙을 가진 보이지 않는 거울에 같은 글을 흘려 자리를 재고,
 *  반짝임은 글칸 위에 따로 겹쳐 얹는다. */
import { useLayoutEffect, useRef } from 'react'
import type { ScreenRect } from '../actions/layout'
import { scaleOf } from './reveal'

interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface TextFlashPlan {
  /** 같은 자리를 연달아 찾아도 처음부터 다시 깜빡이게 하는 열쇠 */
  key: number
  target: HTMLTextAreaElement
  /** 글칸의 안쪽(테두리 안) 자리. 반짝임 틀을 여기에 맞춰 놓는다. */
  frame: Box
  /** 찾은 글자들. 글칸 안쪽 기준, 굴리기 전 좌표. 줄이 넘어가면 여러 개다. */
  boxes: Box[]
}

/** 거울이 글칸과 똑같이 글을 흘리려면 이것들이 같아야 한다. */
const MIRRORED = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'font-stretch',
  'font-feature-settings',
  'font-kerning',
  'letter-spacing',
  'word-spacing',
  'line-height',
  'text-transform',
  'text-indent',
  'tab-size',
  'white-space',
  'word-break',
  'overflow-wrap',
  'direction',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
]

function measure(el: HTMLTextAreaElement, from: number, to: number): Box[] {
  const style = getComputedStyle(el)
  const mirror = document.createElement('div')
  for (const prop of MIRRORED) mirror.style.setProperty(prop, style.getPropertyValue(prop))
  Object.assign(mirror.style, {
    position: 'absolute',
    top: '0',
    left: '-99999px',
    visibility: 'hidden',
    border: '0',
    boxSizing: 'border-box',
    // 줄이 접히는 자리까지 같아야 한다. 스크롤 막대를 뺀 안쪽 폭을 그대로 쓴다.
    width: `${el.clientWidth}px`,
    height: 'auto',
    overflow: 'hidden',
  })

  const text = el.value
  const mark = document.createElement('span')
  // 빈 자리라도 높이는 있어야 어디인지 잰다.
  mark.textContent = text.slice(from, to) || '​'
  mirror.append(text.slice(0, from), mark, text.slice(to))
  document.body.append(mirror)
  try {
    const origin = mirror.getBoundingClientRect()
    return Array.from(mark.getClientRects())
      .filter((r) => r.width > 0 || r.height > 0)
      .map((r) => ({ left: r.left - origin.left, top: r.top - origin.top, width: r.width, height: r.height }))
  } finally {
    mirror.remove()
  }
}

/** 찾은 글자가 보이도록 글칸을 굴리고, 반짝임을 얹을 자리를 돌려준다. */
export function revealInTextarea(
  el: HTMLTextAreaElement,
  at: number,
  length: number,
  select: boolean,
  show: (rect: ScreenRect) => void,
): TextFlashPlan | null {
  const from = Math.min(Math.max(0, at), el.value.length)
  const to = Math.min(from + Math.max(0, length), el.value.length)

  if (select) {
    // preventScroll 이 없으면 브라우저가 글칸을 보이게 하려고 캔버스(.board)까지 굴린다.
    el.focus({ preventScroll: true })
    el.setSelectionRange(from, to)
  }

  const boxes = measure(el, from, to)
  if (!boxes.length) return null

  const top = Math.min(...boxes.map((b) => b.top))
  const bottom = Math.max(...boxes.map((b) => b.top + b.height))
  const first = boxes[0]
  const edge = el.clientHeight * 0.12
  if (top < el.scrollTop + edge || bottom > el.scrollTop + el.clientHeight - edge) {
    el.scrollTop = (top + bottom) / 2 - el.clientHeight / 2
  }
  // 줄을 접지 않는 코드 보기에서만 생긴다. 가운데까지 끌지 않고 줄 앞쪽이 함께 보이게 둔다.
  if (first.left < el.scrollLeft || first.left + first.width > el.scrollLeft + el.clientWidth) {
    el.scrollLeft = first.left - el.clientWidth / 3
  }

  const k = scaleOf(el)
  const box = el.getBoundingClientRect()
  const x = box.left + (el.clientLeft + first.left - el.scrollLeft) * k
  const y = box.top + (el.clientTop + top - el.scrollTop) * k
  show({ left: x, top: y, right: x + first.width * k, bottom: y + (bottom - top) * k })

  return {
    key: Date.now(),
    target: el,
    frame: {
      left: el.offsetLeft + el.clientLeft,
      top: el.offsetTop + el.clientTop,
      width: el.clientWidth,
      height: el.clientHeight,
    },
    boxes,
  }
}

/** 글칸 바로 옆(같은 부모)에 둔다. 그래야 글칸의 offsetLeft/Top 과 같은 기준으로 자리가 잡힌다. */
export function TextFlash({ plan, onDone }: { plan: TextFlashPlan; onDone: () => void }) {
  const layer = useRef<HTMLDivElement | null>(null)
  const done = useRef(onDone)
  done.current = onDone

  useLayoutEffect(() => {
    const el = plan.target
    // 반짝이는 동안 글칸을 굴리면 따라 움직인다. React 를 거치지 않고 바로 옮긴다.
    const follow = () => {
      if (layer.current) layer.current.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`
    }
    const stop = () => done.current()
    follow()
    el.addEventListener('scroll', follow)
    // 글을 고치기 시작하면 재 둔 자리가 틀어진다. 시간이 다 되어 끄는 것은 부르는 쪽이 한다.
    el.addEventListener('input', stop)
    return () => {
      el.removeEventListener('scroll', follow)
      el.removeEventListener('input', stop)
    }
  }, [plan])

  const { frame } = plan
  return (
    <div
      className="findflash"
      style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
      aria-hidden
    >
      <div ref={layer} className="findflash__layer">
        {plan.boxes.map((b, i) => (
          <span
            key={i}
            className="findflash__box"
            style={{ left: b.left, top: b.top, width: b.width, height: b.height }}
          />
        ))}
      </div>
    </div>
  )
}
