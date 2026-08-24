/** 아주 작은 마크다운 렌더러.
 *
 *  라이브러리를 붙이지 않은 이유가 둘 있다. 하나는 용량이고, 더 중요한 하나는 안전이다.
 *  대개의 렌더러는 HTML 문자열을 뱉고 그걸 innerHTML 로 꽂아야 하는데,
 *  그러면 붙여넣은 글이 스크립트가 될 길이 열린다.
 *  여기서는 React 엘리먼트를 바로 만들기 때문에 그 길 자체가 없다.
 *
 *  다루는 것: 제목, 목록, 인용, 구분선, 표, 코드 블록, 굵게/기울임/취소선/인라인 코드/링크.
 *  그 밖의 문법은 글자 그대로 남는다 — 메모에 쓰는 마크다운은 대개 이 범위 안이다.
 *
 *  그린 것마다 `data-line`(원본 몇째 줄에서 나왔는지)과 `data-span`(몇 줄을 먹었는지)을 달아 둔다.
 *  LiveMarkdown 이 "누른 자리가 원문의 어디인가" 를 되짚을 때 이 둘만 있으면 된다. */
import type { ReactNode } from 'react'
import { openExternal } from '../platform/browser'

/** 한 줄만 원문 그대로 보여 줄 때 쓰는 갈고리.
 *  `line` 은 인용 안이든 목록 안이든 **원본 전체** 기준 줄 번호다. */
export interface RawLine {
  line: number
  render: (line: number) => ReactNode
}

export function Markdown({ text, raw }: { text: string; raw?: RawLine }) {
  return <div className="md">{renderBlocks(text.split(/\r?\n/), 0, raw ?? null)}</div>
}

/** `lines` 는 이 덩어리만 잘라 온 줄들이고, `base` 는 그 첫 줄이 원본에서 몇째였는지다.
 *  인용처럼 파고들 때 `>` 를 떼고 다시 부르므로, 줄 번호를 따로 들고 다녀야 어긋나지 않는다. */
function renderBlocks(lines: string[], base: number, live: RawLine | null): ReactNode[] {
  const out: ReactNode[] = []
  let i = 0
  let key = 0

  /** 지금 고치고 있는 줄인가. */
  const hot = (n: number) => live !== null && live.line === base + n
  const hotIn = (from: number, to: number) => live !== null && live.line >= base + from && live.line < base + to
  const raw = () => live?.render(live.line)

  /** 표·코드처럼 문법을 감추면 오히려 못 고치는 자리. 줄을 그대로 늘어놓는다. */
  const sourceLines = (from: number, to: number): ReactNode[] => {
    const rows: ReactNode[] = []
    for (let n = from; n < to; n += 1) {
      rows.push(
        <div key={`s${n}`} className="md__source" data-line={base + n} data-span={1}>
          {hot(n) ? raw() : lines[n] || ' '}
        </div>,
      )
    }
    return rows
  }

  while (i < lines.length) {
    const line = lines[i]

    // 코드 블록 — 닫는 울타리가 없으면 끝까지 코드로 본다.
    const fence = /^\s*```(.*)$/.exec(line)
    if (fence) {
      const from = i
      const body: string[] = []
      i += 1
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
      if (i < lines.length) i += 1
      if (hotIn(from, i)) {
        out.push(...sourceLines(from, i))
        continue
      }
      out.push(
        <pre key={key++} className="md__code" data-line={base + from} data-span={i - from}>
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
        <Tag key={key++} className={`md__h md__h--${level}`} data-line={base + i} data-span={1}>
          {hot(i) ? raw() : inline(heading[2])}
        </Tag>,
      )
      i += 1
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      // 구분선은 안에 글을 담을 수 없으니, 고치는 동안만 줄 모습으로 되돌린다.
      if (hot(i)) out.push(...sourceLines(i, i + 1))
      else out.push(<hr key={key++} className="md__hr" data-line={base + i} data-span={1} />)
      i += 1
      continue
    }

    // 표 — 머리줄 다음이 구분줄일 때만 표로 본다.
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const from = i
      const head = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(splitRow(lines[i++]))
      if (hotIn(from, i)) {
        out.push(...sourceLines(from, i))
        continue
      }
      out.push(
        <table key={key++} className="md__table" data-line={base + from} data-span={i - from}>
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
      const from = i
      const body: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''))
      out.push(
        <blockquote key={key++} className="md__quote">
          {renderBlocks(body, base + from, live)}
        </blockquote>,
      )
      continue
    }

    const bullet = /^\s*([-*+])\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      const ordered = Boolean(numbered)
      const items: { at: number; text: string }[] = []
      while (i < lines.length) {
        const m = ordered ? /^\s*\d+\.\s+(.*)$/.exec(lines[i]) : /^\s*[-*+]\s+(.*)$/.exec(lines[i])
        if (!m) break
        items.push({ at: i, text: ordered ? m[1] : m[2] ?? m[1] })
        i += 1
      }
      const List = ordered ? 'ol' : 'ul'
      // 고치는 칸은 <li> **안에** 들어간다. 목록을 쪼개면 번호가 1 부터 다시 시작한다.
      out.push(
        <List key={key++} className="md__list">
          {items.map((item) => (
            <li key={item.at} data-line={base + item.at} data-span={1}>
              {hot(item.at) ? raw() : inline(item.text)}
            </li>
          ))}
        </List>,
      )
      continue
    }

    if (!line.trim()) {
      // 빈 줄은 그릴 것이 없지만, 캐럿이 거기 있으면 고칠 칸은 있어야 한다.
      if (hot(i)) out.push(...sourceLines(i, i + 1))
      i += 1
      continue
    }

    // 이어지는 줄을 한 문단으로 묶는다.
    const from = i
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) i += 1
    const to = i
    if (!hotIn(from, to)) {
      out.push(
        <p key={key++} className="md__p" data-line={base + from} data-span={to - from}>
          {inline(lines.slice(from, to).join('\n'))}
        </p>,
      )
      continue
    }
    // 고치는 줄만 문단에서 떼어 낸다. 앞뒤는 그대로 그려 둔다.
    const rel = (live as RawLine).line - base
    if (rel > from) {
      out.push(
        <p key={key++} className="md__p" data-line={base + from} data-span={rel - from}>
          {inline(lines.slice(from, rel).join('\n'))}
        </p>,
      )
    }
    out.push(
      <p key={key++} className="md__p">
        {raw()}
      </p>,
    )
    if (rel + 1 < to) {
      out.push(
        <p key={key++} className="md__p" data-line={base + rel + 1} data-span={to - rel - 1}>
          {inline(lines.slice(rel + 1, to).join('\n'))}
        </p>,
      )
    }
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
