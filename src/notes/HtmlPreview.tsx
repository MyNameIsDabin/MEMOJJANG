/** 붙여넣은 HTML 을 그려서 보여준다.
 *
 *  `sandbox=""` 를 붙인 iframe 안에서만 그린다. 값이 빈 문자열이면 스크립트도, 폼도,
 *  부모 문서 접근도 전부 막힌다. 남의 글을 그대로 그리는 일에서 이보다 확실한 울타리는 없다.
 *  (본문에 innerHTML 로 꽂았다면 `<img onerror=…>` 한 줄로 스크립트가 돈다.) */
import { useMemo } from 'react'

/** 미리보기 안쪽 글자·바탕을 지금 테마에 맞춘다. */
function frameStyle(): string {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return `body{margin:8px;background:${read('--face-2', '#fff')};color:${read('--text', '#000')};
    font-family:${read('--ui-font', 'sans-serif')};font-size:${read('--ui-size', '11px')};line-height:1.5}
    a{color:${read('--sel', '#06c')}}
    img,video{max-width:100%}
    table{border-collapse:collapse}
    td,th{border:1px solid ${read('--line', '#ccc')};padding:2px 4px}`
}

export function HtmlPreview({ html }: { html: string }) {
  const doc = useMemo(
    () => `<!doctype html><meta charset="utf-8"><style>${frameStyle()}</style>${html}`,
    [html],
  )

  return <iframe className="memo__html" sandbox="" srcDoc={doc} title="HTML 미리보기" />
}
