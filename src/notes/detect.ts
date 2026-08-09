/** 붙여넣은 글이 어떤 종류인지 짐작한다.
 *
 *  판단을 두 층으로 나눴다.
 *
 *  - **내장 규칙**은 여러 약한 신호에 점수를 매겨 합산한다. "# 로 시작하는 줄"
 *    하나만으로 마크다운이라 단정할 수 없고, 목록·굵게·링크가 함께 보여야 확신이 선다.
 *    이런 판단은 설정 화면에서 사람이 적기 어려우므로 코드로 두고 켜기/끄기만 열어 둔다.
 *  - **내 규칙**은 조건 하나짜리로 단순하게 둔다. 대신 내장보다 먼저,
 *    적어 둔 차례대로 먼저 맞는 것이 이긴다. 내 뜻이 언제나 우선하도록.
 *
 *  사용자에게 코드를 적게 하지 않는 이유: 캔버스 파일이 실행 경로가 되어 버린다.
 */
import type { MemoView } from '../types'

export interface UserRule {
  id: string
  label: string
  view: MemoView
  /** 어떻게 견줄지 */
  when: 'startsWith' | 'contains' | 'regex'
  value: string
}

export interface BuiltinRule {
  id: string
  label: string
  view: MemoView
  /** 설정 화면에 보여줄 판단 근거 설명 */
  note: string
}

export const BUILTIN_RULES: BuiltinRule[] = [
  { id: 'json', label: 'JSON', view: 'json', note: '글 전체가 JSON 으로 읽힐 때' },
  { id: 'html', label: 'HTML', view: 'html', note: '<태그>로 시작하거나 태그가 여럿 보일 때' },
  {
    id: 'markdown',
    label: '마크다운',
    view: 'markdown',
    note: '# 제목, - 목록, **굵게**, [링크](…), ``` 같은 표시가 여럿 보일 때',
  },
  { id: 'code', label: '코드', view: 'code', note: '코드처럼 생긴 줄이 많을 때' },
]

export const VIEW_LABEL: Record<MemoView, string> = {
  plain: '그대로',
  markdown: '마크다운',
  code: '코드',
  json: 'JSON',
  html: 'HTML',
}

/** 이 점수를 넘겨야 그 유형이라고 본다. 애매하면 그대로 두는 편이 낫다. */
const THRESHOLD = 3

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

function scoreHtml(text: string): number {
  const head = text.trimStart().slice(0, 200).toLowerCase()
  let score = 0
  if (/^<!doctype html/.test(head) || /^<html[\s>]/.test(head)) score += 6
  if (/^<(div|p|span|table|ul|ol|section|article|body|head|h[1-6])[\s>]/.test(head)) score += 3
  // 여는 태그와 닫는 태그가 짝을 이뤄 여러 번 나오면 문서로 본다.
  const tags = countMatches(text, /<\/?[a-z][a-z0-9-]*(\s[^<>]*)?>/gi)
  if (tags >= 6) score += 3
  else if (tags >= 3) score += 2
  return score
}

function scoreMarkdown(text: string): number {
  const lines = text.split(/\r?\n/)
  let score = 0
  if (lines.some((l) => /^#{1,6}\s+\S/.test(l))) score += 2
  if (lines.filter((l) => /^\s*([-*+]\s+\S|\d+\.\s+\S)/.test(l)).length >= 2) score += 2
  if (/```/.test(text)) score += 3
  if (/\*\*[^*\n]+\*\*/.test(text)) score += 2
  if (/\[[^\]\n]+\]\([^)\s]+\)/.test(text)) score += 2
  if (lines.some((l) => /^>\s+\S/.test(l))) score += 1
  if (lines.some((l) => /^(-{3,}|\*{3,}|_{3,})\s*$/.test(l))) score += 1

  // 머리줄 바로 밑에 구분줄이 오는 표는 다른 무엇으로도 읽히지 않는다.
  // 이것만으로 마크다운이라 보기에 충분하다 (Markdown.tsx 가 표로 인정하는 조건과 같다).
  const hasTable = lines.some(
    (l, i) => /^\s*\|.+\|\s*$/.test(l) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? ''),
  )
  if (hasTable) score += 4

  return score
}

function scoreJson(text: string): number {
  const trimmed = text.trim()
  // 통째로 읽히는지가 전부다. 반쪽짜리를 JSON 이라 부르면 도움이 안 된다.
  if (trimmed.length < 2 || !/^[[{]/.test(trimmed) || !/[\]}]$/.test(trimmed)) return 0
  try {
    JSON.parse(trimmed)
    return 8
  } catch {
    return 0
  }
}

function scoreCode(text: string): number {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return 0
  let score = 0
  if (/\b(function|const|let|var|class|def|import|export|return|public|private)\b/.test(text)) score += 2
  const codeish = lines.filter((l) => /[;{}]\s*$/.test(l) || /^\s{2,}\S/.test(l)).length
  if (codeish / lines.length > 0.4) score += 2
  if (/=>|::|\breturn\b|\bif\s*\(/.test(text)) score += 1
  return score
}

const BUILTIN_SCORERS: Record<string, (text: string) => number> = {
  json: scoreJson,
  html: scoreHtml,
  markdown: scoreMarkdown,
  code: scoreCode,
}

export function matchesUserRule(rule: UserRule, text: string): boolean {
  const value = rule.value.trim()
  if (!value) return false
  if (rule.when === 'startsWith') return text.trimStart().startsWith(value)
  if (rule.when === 'contains') return text.includes(value)
  try {
    return new RegExp(value, 'm').test(text)
  } catch {
    // 정규식이 잘못 적혔으면 조용히 넘어간다. 설정 화면이 따로 알려 준다.
    return false
  }
}

export function isValidRegex(source: string): boolean {
  try {
    new RegExp(source, 'm')
    return true
  } catch {
    return false
  }
}

export interface DetectOptions {
  userRules: UserRule[]
  /** 꺼 둔 내장 규칙의 id */
  disabledBuiltins: string[]
}

/** 글을 보고 보기 유형을 정한다. 확신이 안 서면 'plain'. */
export function detectView(text: string, options: DetectOptions): MemoView {
  if (!text.trim()) return 'plain'

  // 내 규칙이 먼저. 적어 둔 차례대로 먼저 맞는 것이 이긴다.
  for (const rule of options.userRules) {
    if (matchesUserRule(rule, text)) return rule.view
  }

  let best: { view: MemoView; score: number } | null = null
  for (const rule of BUILTIN_RULES) {
    if (options.disabledBuiltins.includes(rule.id)) continue
    const score = BUILTIN_SCORERS[rule.id]?.(text) ?? 0
    if (score >= THRESHOLD && (!best || score > best.score)) best = { view: rule.view, score }
  }
  return best?.view ?? 'plain'
}
