/** 할 일 하나의 마감 시각을 정하는 작은 창. 시계 단추 아래에 붙는다. */
import { useEffect, useRef, useState } from 'react'
import type { TodoItem } from '../types'
import { DUE_PRESETS, fromDateTimeInput, suggestedDue, toDateTimeInput } from './due'
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
      {/* 지금부터 얼마 뒤 — 짧은 마감을 자주 쓰므로 분·시간·일을 한 줄씩 갈라 둔다 */}
      {DUE_PRESETS.map((group) => (
        <div key={group.unit} className="duepop__quick">
          {group.items.map((preset) => (
            <button
              key={preset.offset}
              type="button"
              className="btn duepop__chip"
              onClick={() => onApply(Date.now() + preset.offset)}
            >
              {say(preset.labelKey, { n: preset.n })}
            </button>
          ))}
        </div>
      ))}

      <input
        className="duepop__input bevel-in"
        type="datetime-local"
        value={value}
        autoFocus
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
