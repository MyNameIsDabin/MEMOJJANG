/** 가로로 늘어선 항목 중 몇 개까지 들어가는지 재는 훅.
 *
 *  창을 좁히면 버튼이 찌그러지거나 잘려 나가는 대신, 뒤에서부터 ⋯ 메뉴로 접어 넣는다.
 *
 *  접힌 항목은 DOM 에서 사라져 더 이상 잴 수 없다. 그래서 순서를 이렇게 잡는다:
 *  일단 전부 펼친 채로 한 프레임 그려서 각자의 너비를 기록해 두고, 그 다음에 접는다.
 *  이후 창 크기가 바뀔 때는 기록해 둔 너비로 계산만 다시 한다. */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface Overflow {
  /** 그대로 보여줄 항목 수. 나머지는 ⋯ 메뉴로 간다. */
  visible: number
  containerRef: React.RefObject<HTMLDivElement | null>
  itemRef: (index: number) => (el: HTMLElement | null) => void
}

/** 항목 사이 간격. toolbar.css 의 gap 과 맞춰야 한다. */
const GAP = 5

/**
 * @param count       접을 수 있는 항목 수
 * @param getReserved 늘 자리를 차지하는 것들의 너비를 그때그때 재서 돌려준다
 *                    (브랜드, 확대 컨트롤, ⋯ 버튼 …). 상수로 어림잡으면 필요 이상으로 일찍 접힌다.
 * @param remeasureOn 이 값이 바뀌면 너비를 다시 잰다 (글꼴이 바뀌면 버튼도 커진다)
 */
export function useOverflow(count: number, getReserved: () => number, remeasureOn: unknown): Overflow {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const nodes = useRef<(HTMLElement | null)[]>([])
  const widths = useRef<number[]>([])
  const [visible, setVisible] = useState(count)

  const itemRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      nodes.current[index] = el
    },
    [],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const fit = () => {
      const available = container.clientWidth - getReserved()
      let used = 0
      let fits = 0
      for (let i = 0; i < count; i += 1) {
        used += (widths.current[i] ?? 0) + GAP
        if (used > available) break
        fits += 1
      }
      setVisible(fits)
    }

    // 우선 전부 펼쳐서 원래 너비를 볼 수 있게 한다.
    setVisible(count)
    const frame = requestAnimationFrame(() => {
      for (let i = 0; i < count; i += 1) {
        const el = nodes.current[i]
        if (el) widths.current[i] = el.getBoundingClientRect().width
      }
      fit()
    })

    // 창 크기만 바뀐 경우 항목 너비는 그대로다. 계산만 다시 한다.
    const observer = new ResizeObserver(fit)
    observer.observe(container)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
    // getReserved 는 매 렌더 새로 만들어지므로 의존성에 넣지 않는다.
    // 실제로 값이 달라지는 계기는 글꼴 변경(remeasureOn)과 창 크기 변경(ResizeObserver) 뿐이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, remeasureOn])

  return { visible, containerRef, itemRef }
}
