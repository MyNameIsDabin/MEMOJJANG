import { useShallow } from 'zustand/react/shallow'
import { useToasts } from './toast'
import { useT } from '../i18n'
import './toast.css'

export function Toasts() {
  const say = useT()
  const toasts = useToasts(useShallow((s) => s.toasts))
  if (!toasts.length) return null

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast bevel-out toast--${t.kind}`}
          title={say('toast.close')}
          onClick={() => useToasts.getState().dismiss(t.id)}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
