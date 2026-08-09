/** 위쪽 제목 줄과 아래쪽 상태 줄의 실제 높이를 재서 CSS 변수로 내놓는다.
 *
 *  두 줄의 높이는 글자 크기 설정과 탭 개수에 따라 달라진다. 숫자를 CSS 에 박아 두면
 *  '크게' 로 바꾼 순간 화면 가득 펼친 노트가 상태 줄에 깔린다. */
import { useEffect } from 'react'

export function useChromeMetrics(): void {
  useEffect(() => {
    const root = document.documentElement

    const publish = () => {
      const chrome = document.querySelector('.chrome')
      const footer = document.querySelector('.footer')
      if (chrome) root.style.setProperty('--chrome-h', `${Math.round(chrome.getBoundingClientRect().height)}px`)
      if (footer) root.style.setProperty('--footer-h', `${Math.round(footer.getBoundingClientRect().height)}px`)
    }

    publish()

    // 창 크기·글자 크기·탭 줄바꿈까지 전부 잡으려면 두 요소를 직접 지켜보는 편이 확실하다.
    const observer = new ResizeObserver(publish)
    for (const selector of ['.chrome', '.footer']) {
      const el = document.querySelector(selector)
      if (el) observer.observe(el)
    }
    window.addEventListener('resize', publish)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', publish)
    }
  }, [])
}
