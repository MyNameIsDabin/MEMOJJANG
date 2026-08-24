/** 그려지는 크기를 스스로 재서 확대/축소 방식을 고르는 <img>.
 *
 *  `image-rendering: pixelated` 는 가장 가까운 픽셀 하나를 그대로 집어 온다. 도트 그림을 **키울** 때는
 *  이게 맞다 — 네모가 네모로 남는다. 그런데 큰 스크린샷을 작게 **줄일** 때는 사이에 있던 픽셀을
 *  통째로 버리기 때문에 글자 획이 끊기고 가는 선이 들쭉날쭉해진다. 다른 그림 보기 프로그램이
 *  줄여도 멀쩡해 보이는 것은 줄일 때만 주변 픽셀을 평균 내기 때문이다.
 *
 *  그래서 한쪽으로 못 박지 않고, 지금 그려지는 폭이 원본보다 작으면 `auto`(부드럽게),
 *  같거나 크면 `pixelated`(또렷하게) 로 나눈다. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoard } from '../store/boardStore'

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** 이 그림 위에 겹쳐 걸린 transform 배율(캔버스 확대 × 스티커 크기).
   *  재는 값은 transform 이 걸리기 **전** 크기라, 곱해 줄 몫은 부르는 쪽이 알려 줘야 한다. */
  scale?: number
}

export function FitImage({ scale = 1, style, onLoad, ...rest }: Props) {
  const ref = useRef<HTMLImageElement>(null)
  /** [그려지는 폭, 원본 폭] — 둘을 한 번에 재야 로드 직후 한 박자 어긋나지 않는다. */
  const [[shown, natural], setSize] = useState<[number, number]>([0, 0])

  const measure = useCallback(() => {
    const img = ref.current
    if (!img) return
    const ratio = img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1
    // object-fit: contain 이면 상자 안에 여백이 남는다. 그림이 실제로 차지하는 폭만 센다.
    const width = Math.min(img.clientWidth, img.clientHeight * ratio)
    setSize((cur) => (cur[0] === width && cur[1] === img.naturalWidth ? cur : [width, img.naturalWidth]))
  }, [])

  useEffect(() => {
    const img = ref.current
    if (!img) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(img)
    return () => ro.disconnect()
  }, [measure, rest.src])

  const dpr = window.devicePixelRatio || 1
  // 1:1 언저리는 또렷한 쪽에 남긴다. 재는 값이 소수라 아슬아슬하게 넘나들면 그림이 깜빡인다.
  const shrinking = shown > 0 && natural > 0 && shown * scale * dpr < natural * 0.98

  return (
    <img
      {...rest}
      ref={ref}
      style={{ ...style, imageRendering: shrinking ? 'auto' : 'pixelated' }}
      onLoad={(e) => {
        measure()
        onLoad?.(e)
      }}
    />
  )
}

/** 캔버스 배율. 성기게 본다 — 확대하는 동안 매 프레임 다시 그려 봐야 방식이 바뀌는 목은
 *  1:1 한 곳뿐이라 손해만 크다. 한 칸이 약 12% 라 그 목을 놓치지 않는다. */
export function useCanvasScale(): number {
  return useBoard((s) => 2 ** (Math.round(Math.log2(s.viewport.zoom) * 6) / 6))
}
