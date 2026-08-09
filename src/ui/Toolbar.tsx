/** 창 위쪽 도구 줄.
 *
 *  노트 추가와 찾기는 캔버스 우클릭 메뉴에, 배율과 고정은 아래 상태 줄에 있다.
 *  여기 남은 것은 캔버스를 만지는 기능뿐이고, 폭이 모자라면 뒤에서부터 ⋯ 로 접힌다. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoard } from '../store/boardStore'
import { useSettings } from '../store/settingsStore'
import { useUi } from '../store/uiStore'
import { useCanvases } from '../store/canvasStore'
import { arrangeGrid, zoomToFit } from '../actions/layout'
import { Icon, type IconName } from './Icon'
import { useOverflow } from './useOverflow'
import './chrome.css'

interface Action {
  key: string
  icon: IconName
  label: string
  hint?: string
  pressed?: boolean
  disabled?: boolean
  /** 캔버스가 없어도 쓸 수 있는가 */
  always?: boolean
  run: () => void
}

/** ⋯ 버튼 자리. 접힌 게 없을 때도 비워 둬야 마지막 하나가 들락날락하지 않는다. */
const MORE_WIDTH = 34

/** 접힌 메뉴의 최소 폭. 좁은 창에서 얼마나 당겨 붙일지 계산하는 데 쓴다(css 와 같은 값). */
const MENU_WIDTH = 200

export function Toolbar() {
  const count = useBoard((s) => s.noteIds.length)
  const snapToGrid = useSettings((s) => s.snapToGrid)
  const font = useSettings((s) => `${s.font}/${s.fontScale}`)
  const hasCanvas = useCanvases((s) => s.activeId !== null)

  const [menuOpen, setMenuOpen] = useState(false)

  const actions: Action[] = [
    {
      key: 'fit',
      icon: 'fit',
      label: '전체 보기',
      hint: 'Ctrl+Shift+0',
      disabled: !count,
      run: () => zoomToFit(),
    },
    {
      key: 'arrange',
      icon: 'grid',
      label: '격자로 정리',
      hint: 'Ctrl+Shift+G',
      disabled: count < 2,
      run: () => arrangeGrid(useBoard.getState().selection),
    },
    {
      key: 'snap',
      icon: 'snap',
      label: '격자에 붙이기',
      pressed: snapToGrid,
      run: () => useSettings.getState().set('snapToGrid', !snapToGrid),
    },
    {
      key: 'search',
      icon: 'search',
      label: '보드에서 찾기',
      hint: 'Ctrl+F',
      disabled: !count,
      run: useUi.getState().openSearch,
    },
    {
      key: 'settings',
      icon: 'settings',
      label: '설정',
      always: true,
      run: useUi.getState().openSettings,
    },
  ]

  const getReserved = useCallback(() => MORE_WIDTH, [])
  const { visible, containerRef, itemRef } = useOverflow(actions.length, getReserved, font)
  const hidden = actions.slice(visible)

  const isOff = (action: Action) => action.disabled || (!hasCanvas && !action.always)

    // 아이콘 오른쪽의 빈 자리가 그대로 창을 끄는 손잡이가 된다.
    // 버튼에는 이 표시를 붙이지 않아야 버튼이 제 일을 한다.
  return (
    <div className="toolbar" ref={containerRef} data-tauri-drag-region>
      {actions.slice(0, visible).map((action, index) => (
        <button
          key={action.key}
          ref={itemRef(index)}
          className="chip"
          aria-pressed={action.pressed}
          aria-label={action.label}
          disabled={isOff(action)}
          title={action.hint ? `${action.label} (${action.hint})` : action.label}
          onClick={action.run}
        >
          <Icon name={action.icon} />
        </button>
      ))}

      {hidden.length > 0 && (
        <OverflowMenu
          actions={hidden}
          open={menuOpen}
          onToggle={() => setMenuOpen((v) => !v)}
          onClose={() => setMenuOpen(false)}
          isOff={isOff}
        />
      )}
    </div>
  )
}

function OverflowMenu({
  actions,
  open,
  onToggle,
  onClose,
  isOff,
}: {
  actions: Action[]
  open: boolean
  onToggle: () => void
  onClose: () => void
  isOff: (action: Action) => boolean | undefined
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  // 메뉴는 도구 줄 밖(화면 기준)에 띄운다 — 도구 줄이 넘치는 아이콘을 잘라 내기 때문이다.
  // 그래서 자리는 버튼을 재서 직접 잡아 준다.
  const [spot, setSpot] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open) {
      setSpot(null)
      return
    }
    const box = buttonRef.current?.getBoundingClientRect()
    if (!box) return
    // 창이 좁으면 메뉴가 오른쪽으로 삐져나간다. 그때는 안쪽으로 당겨 붙인다.
    const left = Math.min(box.left, window.innerWidth - MENU_WIDTH - 4)
    setSpot({ top: box.bottom + 4, left: Math.max(4, left) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <div className="toolbar__more" ref={ref}>
      <button
        ref={buttonRef}
        className="chip"
        aria-expanded={open}
        title={`가려진 기능 ${actions.length}개`}
        onClick={onToggle}
      >
        <Icon name="more" />
      </button>

      {open && spot && (
        <div className="menu bevel-out toolbar__moremenu" style={{ top: spot.top, left: spot.left }}>
          {actions.map((action) => (
            <button
              key={action.key}
              className="menu__item"
              disabled={isOff(action)}
              onClick={() => {
                action.run()
                onClose()
              }}
            >
              <span className="menu__key">
                <Icon name={action.icon} />
                {action.label}
                {action.pressed ? ' ✔' : ''}
              </span>
              {action.hint && <span className="menu__hint">{action.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
