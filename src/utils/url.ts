/** 주소 다루기.
 *
 *  컴포넌트 파일이 아니라 여기 있는 이유: 컴포넌트와 일반 함수를 한 파일에서 함께 내보내면
 *  React Fast Refresh 가 그 파일을 통째로 다시 불러온다. */

/** 사람은 보통 "example.com" 처럼 스킴을 빼고 적는다. 빠진 건 채워 준다. */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function hostOf(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname
  } catch {
    return ''
  }
}

/** 주소로 볼 만한가.
 *
 *  느슨하게 잡으면 평범한 글까지 주소로 오인해 엉뚱한 곳에 들어간다. 그래서 빡빡하게 본다:
 *  공백이 없어야 하고, 스킴이 있거나 "점으로 이어진 이름 + 글자로 된 최상위 도메인" 이어야 한다. */
export function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true

  const host = trimmed.split(/[/?#]/, 1)[0]
  return /^[\w-]+(\.[\w-]+)+$/.test(host) && /\.[a-z]{2,}$/i.test(host)
}

/** 붙여넣은 글에서 주소 목록을 뽑는다.
 *
 *  한 줄이라도 주소가 아니면 빈 배열을 돌려준다 — 글과 주소가 섞인 덩어리를 쪼개 버리면
 *  원문이 망가진다. 그럴 땐 통째로 메모가 되는 편이 낫다. */
export function extractUrls(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length || !lines.every(looksLikeUrl)) return []
  return lines.map(normalizeUrl)
}
