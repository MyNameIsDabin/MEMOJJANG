/** 공용 확인 팝업. 화면에 하나만 있고, 부르는 쪽은 confirmAsk() 만 안다. */
import { useEffect, useRef } from 'react'
import { useConfirm } from './confirm'
import { useT } from '../i18n'
import './confirm.css'

export function ConfirmDialog() {
  const open = useConfirm((s) => s.open)
  const say = useT()
  const yesRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const settle = useConfirm.getState().settle
    const onKey = (e: KeyboardEvent) => {
      // Esc 는 그만두기. Enter 는 일부러 잇지 않았다 — 되돌릴 수 없는 일은 눈으로 보고 눌러야 한다.
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      settle(false)
    }
    // capture 로 받아야 캔버스와 패널들의 Esc 처리보다 먼저 닫힌다.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  useEffect(() => {
    // 손이 이미 '그만두기' 쪽에 있게 둔다. 열자마자 Enter 를 쳐도 아무 일이 없도록.
    if (open) yesRef.current?.focus()
  }, [open])

  if (!open) return null

  const settle = useConfirm.getState().settle

  return (
    <div className="confirm__backdrop" onPointerDown={() => settle(false)}>
      <div
        className="confirm bevel-out"
        role="alertdialog"
        aria-modal="true"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="confirm__message">{open.message}</p>
        {open.detail && <p className="confirm__detail">{open.detail}</p>}

        <div className="confirm__actions">
          <button ref={yesRef} type="button" className="btn" onClick={() => settle(false)}>
            {say('confirm.cancel')}
          </button>
          <button
            type="button"
            className={`btn${open.danger ? ' btn--danger' : ''}`}
            onClick={() => settle(true)}
          >
            {open.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
