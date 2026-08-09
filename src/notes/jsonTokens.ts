/** JSON 글을 색칠할 조각으로 나눈다.
 *  컴포넌트와 한 파일에 두면 Fast Refresh 가 깨지므로 따로 뒀다. */

export type JsonKind = 'key' | 'string' | 'number' | 'literal' | 'punct' | 'plain'

export interface JsonPiece {
  kind: JsonKind
  text: string
}

/** 한 번에 하나씩 집어내는 조각들. 앞에 적힌 것이 먼저 잡힌다. */
const TOKEN = /("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g

export function tokenizeJson(text: string): JsonPiece[] {
  const pieces: JsonPiece[] = []
  let at = 0

  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0
    if (index > at) pieces.push({ kind: 'plain', text: text.slice(at, index) })

    const [token, string, number, literal, punct] = match
    if (string !== undefined) {
      // 뒤에 콜론이 오면 값이 아니라 이름이다.
      pieces.push({ kind: /^\s*:/.test(text.slice(index + token.length)) ? 'key' : 'string', text: token })
    } else if (number !== undefined) {
      pieces.push({ kind: 'number', text: token })
    } else if (literal !== undefined) {
      pieces.push({ kind: 'literal', text: token })
    } else if (punct !== undefined) {
      pieces.push({ kind: 'punct', text: token })
    }
    at = index + token.length
  }

  if (at < text.length) pieces.push({ kind: 'plain', text: text.slice(at) })
  return pieces
}

/** 보기용으로만 다시 벌려 준다. 본문 자체는 건드리지 않는다. */
export function prettyJson(text: string): { body: string; broken: boolean } {
  try {
    return { body: JSON.stringify(JSON.parse(text), null, 2), broken: false }
  } catch {
    return { body: text, broken: true }
  }
}
