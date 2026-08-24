/** 할 일 하나의 마감 시각을 정하는 작은 창. 시계 단추 아래에 붙는다. */
import { useEffect, useRef, useState } from 'react'
import type { TodoItem } from '../types'
import {
  fromDateTimeInput,
  fromTimerParts,
  suggestedDue,
  toDateTimeInput,
  toTimerParts,
  type TimerParts,
} from './due'
import { useT } from '../i18n'

export function DuePopup({
  item,
  onApply,
  onClear,
  onClose,
}: {
  item: TodoItem
  onApply: (at: number) => void
  onClear: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const say = useT()
  const [value, setValue] = useState(() => toDateTimeInput(item.due ?? suggestedDue(Date.now())))
  /* 타이머 칸은 글자로 들고 있는다. 숫자로 두면 다 지운 칸이 0 으로 되살아나
     "지우고 새로 치기" 가 안 된다. 이미 마감이 있으면 남은 시간을 채워 둔다. */
  const [timer, setTimer] = useState<Record<keyof TimerParts, string>>(() => {
    if (!item.due) return { h: '', m: '', s: '' }
    const left = toTimerParts(item.due - Date.now())
    return { h: String(left.h), m: String(left.m), s: String(left.s) }
  })

  // 칸에 무엇이 적혀 있든 여기서 숫자로 만든다. 빈 칸·글자·음수 모두 0 으로 본다.
  const count = (text: string) => Math.max(0, Number(text) || 0)
  const span = fromTimerParts({ h: count(timer.h), m: count(timer.m), s: count(timer.s) })

  const startTimer = () => {
    if (span === null) return
    onApply(Date.now() + span)
  }

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // capture 로 받아야 캔버스의 포인터 처리보다 먼저 닫힌다.
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const apply = () => {
    const at = fromDateTimeInput(value)
    if (at !== null) onApply(at)
  }

  return (
    <div
      className="duepop bevel-out"
      ref={ref}
      // 노트가 따라 움직이지 않도록 여기서 끊는다.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* 지금부터 얼마 뒤 — 알람 시계처럼 시·분·초만 넣고 곧바로 건다.
          단위를 넘겨 적어도 된다: 90 분은 한 시간 반으로 그냥 더해진다. */}
      <div className="duepop__timer">
        {(['h', 'm', 's'] as const).map((unit) => (
          <label key={unit} className="duepop__unit">
            <input
              className="duepop__num bevel-in"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={timer[unit]}
              autoFocus={unit === 'h'}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setTimer((cur) => ({ ...cur, [unit]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  startTimer()
                }
              }}
            />
            <span className="duepop__unitname">
              {say(({ h: 'due.unitHour', m: 'due.unitMinute', s: 'due.unitSecond' } as const)[unit])}
            </span>
          </label>
        ))}

        <button type="button" className="btn duepop__start" disabled={span === null} onClick={startTimer}>
          {say('due.start')}
        </button>
      </div>

      {/* 날짜까지 정해야 하는 마감은 아래에서. 타이머와 달리 절대 시각이다. */}
      <input
        className="duepop__input bevel-in"
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            apply()
          }
        }}
      />

      <div className="duepop__actions">
        <button type="button" className="btn" onClick={apply}>
          {say('due.set')}
        </button>
        <button type="button" className="btn" onClick={onClear} disabled={!item.due}>
          {say('due.clear')}
        </button>
      </div>
    </div>
  )
}
