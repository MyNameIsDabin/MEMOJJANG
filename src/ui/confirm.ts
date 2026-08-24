/** 되돌릴 수 없는 일을 하기 전에 한 번 더 묻는다.
 *
 *  브라우저의 `window.confirm` 을 쓰지 않는 이유가 둘 있다. 하나는 생김새 — 운영체제 대화상자가
 *  튀어나오면 앱의 픽셀 감성이 그 순간만 깨진다. 다른 하나는 Tauri 창에서 그것이 **웹뷰를 통째로
 *  멈춘다**는 점이다. 자동 저장이나 타이머까지 함께 멈춘다.
 *
 *  부르는 쪽은 토스트와 같다 — 함수 한 줄이면 되고, 어디에 그릴지는 신경 쓰지 않는다:
 *
 *      if (await confirmAsk({ message: say('...'), confirmLabel: say('...') })) 지운다()
 */
import { create } from 'zustand'

export interface ConfirmRequest {
  message: string
  /** 왜 되돌릴 수 없는지 같은 한 줄. 없으면 안 보인다. */
  detail?: string
  /** 진행 단추에 적을 말. 무엇을 하는지가 여기 적혀야 한다 — '확인' 은 아무것도 알려 주지 않는다. */
  confirmLabel: string
  /** 지우는 일이면 참. 진행 단추를 위험한 색으로 그린다. */
  danger?: boolean
}

interface ConfirmState {
  open: ConfirmRequest | null
  /** 대답을 기다리는 쪽에게 돌려줄 길. 답하면 비운다. */
  answer: ((ok: boolean) => void) | null
  ask: (request: ConfirmRequest) => Promise<boolean>
  settle: (ok: boolean) => void
}

export const useConfirm = create<ConfirmState>()((set, get) => ({
  open: null,
  answer: null,

  ask: (request) =>
    new Promise<boolean>((resolve) => {
      // 이미 하나가 떠 있으면 그것부터 끝낸다. 두 개가 겹치면 어느 것에 답한 것인지 알 수 없다.
      get().answer?.(false)
      set({ open: request, answer: resolve })
    }),

  settle: (ok) => {
    const { answer } = get()
    set({ open: null, answer: null })
    answer?.(ok)
  },
}))

export const confirmAsk = (request: ConfirmRequest): Promise<boolean> =>
  useConfirm.getState().ask(request)
