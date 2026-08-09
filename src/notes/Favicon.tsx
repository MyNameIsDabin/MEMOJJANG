/** 바로가기 앞에 붙는 사이트 아이콘.
 *
 *  남의 서비스(파비콘 대행 API)를 거치지 않고 사이트에서 바로 가져온다.
 *  어디를 즐겨찾는지가 제3자에게 새어 나가지 않도록 하기 위해서다.
 *  대신 사이트마다 두는 자리가 달라 실패할 수 있으니 몇 군데를 차례로 두드려 보고,
 *  끝내 없으면 글자 타일로 대신한다. */
import { useEffect, useState } from 'react'
import { ACCENTS } from '../types'
import { hostOf } from '../utils/url'

function candidates(host: string): string[] {
  return [`https://${host}/favicon.ico`, `https://${host}/apple-touch-icon.png`]
}

/** 호스트마다 늘 같은 색이 나오도록 — 새로 고칠 때마다 색이 바뀌면 눈에 거슬린다. */
function accentFor(host: string): string {
  let hash = 0
  for (let i = 0; i < host.length; i += 1) hash = (hash * 31 + host.charCodeAt(i)) >>> 0
  return ACCENTS[hash % ACCENTS.length]
}

export function Favicon({ url, label }: { url: string; label: string }) {
  const host = hostOf(url)
  const [attempt, setAttempt] = useState(0)

  // 주소를 고치면 처음부터 다시 찾아본다.
  useEffect(() => setAttempt(0), [host])

  const sources = candidates(host)
  const letter = (label.trim() || host || '?').charAt(0).toUpperCase()

  if (!host || attempt >= sources.length) {
    return (
      <span
        className="favicon favicon--letter"
        style={{ background: `var(--accent-${accentFor(host)})` }}
        aria-hidden
      >
        {letter}
      </span>
    )
  }

  return (
    <img
      className="favicon"
      src={sources[attempt]}
      alt=""
      draggable={false}
      onError={() => setAttempt((n) => n + 1)}
    />
  )
}
