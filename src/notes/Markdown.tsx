/** 아주 작은 마크다운 렌더러.
 *
 *  라이브러리를 붙이지 않은 이유가 둘 있다. 하나는 용량이고, 더 중요한 하나는 안전이다.
 *  대개의 렌더러는 HTML 문자열을 뱉고 그걸 innerHTML 로 꽂아야 하는데,
 *  그러면 붙여넣은 글이 스크립트가 될 길이 열린다.
 *  여기서는 React 엘리먼트를 바로 만들기 때문에 그 길 자체가 없다.
 *
 *  다루는 것: 제목, 목록, 인용, 구분선, 표, 코드 블록, 굵게/기울임/취소선/인라인 코드/링크.
 *  그 밖의 문법은 글자 그대로 남는다 — 메모에 쓰는 마크다운은 대개 이 범위 안이다. */
import type { ReactNode } from 'react'
import { openExternal } from '../platform/browser'

export function Markdown({ text }: { text: string }) {
  return <div className="md">{renderBlocks(text)}</div>
}

function renderBlocks(text: string): ReactNode[] {
  const lines = text.split(/\r?\n/)
  const out: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // 코드 블록 — 닫는 울타리가 없으면 끝까지 코드로 본다.
    const fence = /^\s*```(.*)$/.exec(line)
    if (fence) {
      const body: string[] = []
      i += 1
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
      i += 1
      out.push(
        <pre key={key++} className="md__code">
          <code>{body.join('\n')}</code>
        </pre>,
      )
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const Tag = `h${Math.min(6, level + 2)}` as 'h3'
      out.push(
        <Tag key={key++} className={`md__h md__h--${level}`}>
          {inline(heading[2])}
        </Tag>,
      )
      i += 1
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push(<hr key={key++} className="md__hr" />)
      i += 1
      continue
    }

    // 표 — 머리줄 다음이 구분줄일 때만 표로 본다.
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const head = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(splitRow(lines[i++]))
      out.push(
        <table key={key++} className="md__table">
          <thead>
            <tr>
              {head.map((cell, n) => (
                <th key={n}>{inline(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, n) => (
                  <td key={n}>{inline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      )
      continue
    }

    if (/^>\s?/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''))
      out.push(
        <blockquote key={key++} className="md__quote">
          {renderBlocks(body.join('\n'))}
        </blockquote>,
      )
      continue
    }

    const bullet = /^\s*([-*+])\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      const ordered = Boolean(numbered)
      const items: string[] = []
      while (i < lines.length) {
        const m = ordered ? /^\s*\d+\.\s+(.*)$/.exec(lines[i]) : /^\s*[-*+]\s+(.*)$/.exec(lines[i])
        if (!m) break
        items.push(ordered ? m[1] : m[2] ?? m[1])
        i += 1
      }
      const List = ordered ? 'ol' : 'ul'
      out.push(
        <List key={key++} className="md__list">
          {items.map((item, n) => (
            <li key={n}>{inline(item)}</li>
          ))}
        </List>,
      )
      continue
    }

    if (!line.trim()) {
      i += 1
      continue
    }

    // 이어지는 줄을 한 문단으로 묶는다.
    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) paragraph.push(lines[i++])
    out.push(
      <p key={key++} className="md__p">
        {inline(paragraph.join('\n'))}
      </p>,
    )
  }

  return out
}

function isBlockStart(line: string): boolean {
  return (
    /^\s*```/.test(line) ||
    /^#{1,6}\s/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*([-*+]|\d+\.)\s+/.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    /^\s*\|.*\|\s*$/.test(line)
  )
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())
}

/** 한 줄 안의 표시들. 겹치지 않게 한 번에 갈라낸다. */
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(~~[^~\n]+~~)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\([^)\s]+\))/

function inline(text: string, depth = 0): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text
  let key = 0

  // 표시 안에 표시가 또 들어가는 경우까지만 파고든다. 무한히 도는 일을 막는다.
  while (rest && depth < 4) {
    const match = INLINE.exec(rest)
    if (!match || match.index === undefined) break

    if (match.index > 0) out.push(rest.slice(0, match.index))
    const token = match[0]

    if (token.startsWith('`')) {
      out.push(
        <code key={key++} className="md__inlinecode">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**')) {
      out.push(<strong key={key++}>{inline(token.slice(2, -2), depth + 1)}</strong>)
    } else if (token.startsWith('~~')) {
      out.push(<del key={key++}>{inline(token.slice(2, -2), depth + 1)}</del>)
    } else if (token.startsWith('*')) {
      out.push(<em key={key++}>{inline(token.slice(1, -1), depth + 1)}</em>)
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
      if (link) {
        out.push(
          <button
            key={key++}
            type="button"
            className="md__link"
            title={link[2]}
            onClick={() => void openExternal(link[2])}
          >
            {inline(link[1], depth + 1)}
          </button>,
        )
      } else {
        out.push(token)
      }
    }

    rest = rest.slice(match.index + token.length)
  }

  if (rest) out.push(rest)
  return out
}
