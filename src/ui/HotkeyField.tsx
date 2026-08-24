/** 전역 단축키를 직접 눌러서 정하는 칸.
 *  조합을 글자로 적게 하는 것보다, 그냥 눌러 보게 하는 편이 훨씬 덜 헷갈린다. */
import { useEffect, useState } from 'react'
import { formatAccelerator } from '../store/settingsStore'
import { useT } from '../i18n'

/** e.code 를 Tauri 가 알아듣는 키 이름으로 옮긴다. */
function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1[0-2])$/.test(code)) return code
  const named: Record<string, string> = {
    Space: 'Space',
    Enter: 'Enter',
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Insert: 'Insert',
    Delete: 'Delete',
    PrintScreen: 'PrintScreen',
  }
  return named[code] ?? null
}

/** 조합이 완성됐으면 accelerator 문자열, 아니면 null. */
function toAccelerator(e: React.KeyboardEvent): string | null {
  const key = keyName(e.code)
  if (!key) return null

  const mods: string[] = []
  if (e.ctrlKey || e.metaKey) mods.push('CommandOrControl')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')

  // 보조키 없는 단일 키를 전역으로 걸면 다른 프로그램에서 그 글자를 못 친다.
  if (!mods.length) return null
  return [...mods, key].join('+')
}

export function HotkeyField({
  value,
  onChange,
  fallback,
}: {
  value: string | null
  onChange: (accelerator: string | null) => void
  /** '기본값' 단추가 되돌릴 자리. 단축키마다 다르다. */
  fallback: string
}) {
  const [capturing, setCapturing] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const t = useT()

  useEffect(() => {
    if (!capturing) setHint(null)
  }, [capturing])

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.key === 'Escape') {
      setCapturing(false)
      return
    }

    const accelerator = toAccelerator(e)
    if (!accelerator) {
      setHint(t('hotkey.needModifier'))
      return
    }
    onChange(accelerator)
    setCapturing(false)
  }

  /* PrintScreen 은 keydown 이 오지 않는다 — 운영체제가 먼저 가로채고 뗄 때만 흘려 준다.
     그래서 이 글쇠 하나만 keyup 으로도 받는다. 나머지는 여기서 아무 일도 하지 않는다. */
  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.code === 'PrintScreen') onKeyDown(e)
  }

  return (
    <div className="hotkey">
      <button
        type="button"
        className={`btn hotkey__slot${capturing ? ' hotkey__slot--live' : ''}`}
        onClick={() => setCapturing(true)}
        onBlur={() => setCapturing(false)}
        onKeyDown={capturing ? onKeyDown : undefined}
        onKeyUp={capturing ? onKeyUp : undefined}
      >
        {capturing ? t('hotkey.press') : value ? formatAccelerator(value) : t('hotkey.off')}
      </button>

      <button type="button" className="btn" onClick={() => onChange(fallback)} disabled={value === fallback}>
        {t('hotkey.default')}
      </button>
      <button type="button" className="btn" onClick={() => onChange(null)} disabled={value === null}>
        {t('hotkey.clear')}
      </button>

      {hint && <span className="hotkey__hint">{hint}</span>}
    </div>
  )
}
