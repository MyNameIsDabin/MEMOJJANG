/** 클립보드 자동 수집. 실제 감시는 Rust 스레드가 하고,
 *  여기서는 알림을 받아 보드에 노트를 얹기만 한다. */
import { useEffect } from 'react'
import { toWorld, useBoard } from '../store/boardStore'
import { isTauri } from '../platform/env'

export type ClipboardEventPayload =
  | { kind: 'text'; text: string }
  | { kind: 'image'; file: string; width: number; height: number }

/** 자동으로 쌓이는 노트가 한자리에 겹치지 않도록 계단식으로 내려놓는다. */
let cascade = 0

function collectPoint(): { x: number; y: number } {
  const vp = useBoard.getState().viewport
  const step = cascade++ % 8
  // 현재 보고 있는 화면의 오른쪽 위 — 눈에는 띄되 작업 공간은 가리지 않는 자리.
  return toWorld(vp, window.innerWidth - 190 - step * 6, 96 + step * 26)
}

export function useClipboardWatch(): void {
  useEffect(() => {
    if (!isTauri()) return

    let unlisten: (() => void) | undefined
    let cancelled = false

    void import('@tauri-apps/api/event').then(({ listen }) =>
      listen<ClipboardEventPayload>('memojjang://clipboard', ({ payload }) => {
        const board = useBoard.getState()
        if (payload.kind === 'text') {
          if (!payload.text.trim()) return
          board.addMemo(payload.text, collectPoint())
        } else {
          board.addImage(
            { file: payload.file, naturalW: payload.width, naturalH: payload.height },
            collectPoint(),
          )
        }
        // 자동 수집물이 방금 만든 것처럼 선택되어 있으면 헷갈린다.
        board.clearSelection()
      }).then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      }),
    )

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])
}
