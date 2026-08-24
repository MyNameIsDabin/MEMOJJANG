/** 할 일 마감 시각을 사람이 읽는 말과 진행도로 바꾼다. */
import type { TodoItem } from '../types'
import { t, type MessageKey } from '../i18n'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export interface DueView {
  /** "3일 남음", "12분 지남" 같은 한 줄 */
  label: string
  overdue: boolean
  /** 0~1. 마감을 정한 순간부터 마감까지 얼마나 왔는지. */
  progress: number
}

/** 마감을 정한 시각을 모르는 옛 항목은 이만큼 전에 정했다고 친다. */
const ASSUMED_WINDOW = 7 * DAY

export function describeDue(item: TodoItem, now: number): DueView | null {
  if (!item.due) return null

  const remaining = item.due - now
  const overdue = remaining < 0
  const gap = Math.abs(remaining)

  // 가장 큰 단위 하나만 쓴다. "2일 3시간 남음" 은 곁눈질로 읽기에 길다.
  //
  // 내림이 아니라 올림인 이유: "3일 뒤" 로 방금 정했는데 곧바로 "2일 남음" 이라고 뜨면
  // 하루를 잃어버린 것처럼 보인다. 올림으로 하면 방금 정한 값이 그대로 읽힌다.
  // 단위는 올린 뒤에 고른다 — 23시간 50분이 "24시간" 이 아니라 "1일" 이 되도록.
  const days = Math.ceil(gap / DAY)
  const hours = Math.ceil(gap / HOUR)
  const minutes = Math.ceil(gap / MINUTE)
  const seconds = Math.ceil(gap / SECOND)

  // 남은 쪽과 지난 쪽을 따로 뽑아 둔다. 말에 따라 어순이 달라서 "{양} + 남음" 으로
  // 이어 붙이면 영어에서 무너진다.
  let key: MessageKey
  let n: number
  if (hours >= 24) [key, n] = [overdue ? 'due.overDays' : 'due.leftDays', days]
  else if (minutes >= 60) [key, n] = [overdue ? 'due.overHours' : 'due.leftHours', hours]
  else if (seconds >= 60) [key, n] = [overdue ? 'due.overMinutes' : 'due.leftMinutes', minutes]
  else [key, n] = [overdue ? 'due.overSeconds' : 'due.leftSeconds', seconds]

  const start = item.dueSetAt ?? item.due - ASSUMED_WINDOW
  const span = Math.max(1, item.due - start)
  const progress = Math.min(1, Math.max(0, (now - start) / span))

  return { label: t(key, { n }), overdue, progress }
}

/** 다음에 화면을 새로 그릴 때까지 기다릴 시간.
 *  마감이 코앞이면 초 단위로, 멀면 느긋하게 — 필요 없는 렌더를 줄인다. */
export function nextTickDelay(items: TodoItem[], now: number): number | null {
  const pending = items.filter((it) => it.due && !it.done)
  if (!pending.length) return null

  const nearest = Math.min(...pending.map((it) => Math.abs((it.due as number) - now)))
  if (nearest < 90 * SECOND) return SECOND
  if (nearest < 90 * MINUTE) return 30 * SECOND
  return MINUTE
}

/** `<input type="datetime-local">` 이 받는 형식. 현지 시각 기준이라 toISOString 은 못 쓴다. */
export function toDateTimeInput(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDateTimeInput(value: string): number | null {
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

/** 마감 팝업을 열었을 때 미리 채워 둘 값 — 오늘 저녁 6시, 이미 지났으면 내일 저녁. */
export function suggestedDue(now: number): number {
  const d = new Date(now)
  d.setHours(18, 0, 0, 0)
  if (d.getTime() <= now) d.setDate(d.getDate() + 1)
  return d.getTime()
}

/* ── 타이머 ─────────────────────────────────────────────────────────
   마감은 결국 시각 하나지만, 사람이 자주 하는 말은 "지금부터 얼마 뒤" 다.
   그래서 알람 시계와 같은 방식으로 시·분·초만 받아 지금 시각에 더한다.        */

export interface TimerParts {
  h: number
  m: number
  s: number
}

/** 시·분·초를 밀리초로. 셋 다 0 이면 정할 것이 없으므로 null. */
export function fromTimerParts({ h, m, s }: TimerParts): number | null {
  const total = h * HOUR + m * MINUTE + s * SECOND
  return total > 0 ? total : null
}

/** 남은 시간을 시·분·초로 가른다. 이미 지났으면 0.
 *  초 단위로 올림하는 이유는 describeDue 와 같다 — 방금 넣은 값이 그대로 다시 읽혀야 한다. */
export function toTimerParts(ms: number): TimerParts {
  const total = Math.max(0, Math.ceil(ms / SECOND) * SECOND)
  return {
    h: Math.floor(total / HOUR),
    m: Math.floor((total % HOUR) / MINUTE),
    s: Math.floor((total % MINUTE) / SECOND),
  }
}
