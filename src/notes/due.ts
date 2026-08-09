/** 할 일 마감 시각을 사람이 읽는 말과 진행도로 바꾼다. */
import type { TodoItem } from '../types'

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

  let amount: string
  if (hours >= 24) amount = `${days}일`
  else if (minutes >= 60) amount = `${hours}시간`
  else if (seconds >= 60) amount = `${minutes}분`
  else amount = `${seconds}초`

  const start = item.dueSetAt ?? item.due - ASSUMED_WINDOW
  const span = Math.max(1, item.due - start)
  const progress = Math.min(1, Math.max(0, (now - start) / span))

  return { label: `${amount} ${overdue ? '지남' : '남음'}`, overdue, progress }
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

/** 지금부터 얼마 뒤로 잡을지. 짧은 마감을 자주 쓰므로 분 단위부터 갖춘다. */
export interface DuePreset {
  label: string
  offset: number
}

export const DUE_PRESETS: { unit: string; items: DuePreset[] }[] = [
  {
    unit: '분',
    items: [
      { label: '5분', offset: 5 * MINUTE },
      { label: '15분', offset: 15 * MINUTE },
      { label: '30분', offset: 30 * MINUTE },
    ],
  },
  {
    unit: '시간',
    items: [
      { label: '1시간', offset: HOUR },
      { label: '2시간', offset: 2 * HOUR },
      { label: '3시간', offset: 3 * HOUR },
    ],
  },
  {
    unit: '일',
    items: [
      { label: '1일', offset: DAY },
      { label: '3일', offset: 3 * DAY },
      { label: '7일', offset: 7 * DAY },
    ],
  },
]
