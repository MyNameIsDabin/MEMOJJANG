/** 짧게 떴다 사라지는 알림.
 *
 *  붙여넣기나 저장이 실패했을 때 아무 일도 일어나지 않는 것처럼 보이면
 *  사용자는 앱이 고장난 줄 안다. 조용히 실패하지 않기 위한 최소 장치. */
import { create } from 'zustand'
import { newId } from '../types'

export type ToastKind = 'info' | 'error'

export interface Toast {
  id: string
  kind: ToastKind
  message: string
}

const LIFETIME = 4000
/** 한꺼번에 여러 개가 쌓여 화면을 덮지 않도록 */
const MAX_VISIBLE = 3

interface ToastState {
  toasts: Toast[]
  push: (message: string, kind: ToastKind) => void
  dismiss: (id: string) => void
}

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  push: (message, kind) => {
    const toast: Toast = { id: newId(), kind, message }
    set((s) => ({ toasts: [...s.toasts, toast].slice(-MAX_VISIBLE) }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== toast.id) })), LIFETIME)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const notify = (message: string, kind: ToastKind = 'info') =>
  useToasts.getState().push(message, kind)

/** 어떤 예외든 사람이 읽을 수 있는 한 줄로 줄인다. */
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return String(err)
}
