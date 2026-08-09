/** 노트 한 장을 캔버스에서 꺼내 화면 가득 펼쳐 놓는 자리.
 *
 *  노트의 x·y·w·h 는 손대지 않는다. 자리와 크기를 CSS 에 맡기므로 창을 늘리면
 *  본문이 알아서 따라 늘어나고, 되돌리면 캔버스에 있던 그대로 남아 있다.
 *
 *  위아래로는 제목 줄과 상태 줄을 피해야 하는데, 그 높이가 글자 크기 설정에 따라
 *  달라진다. 그래서 숫자를 박아 넣지 않고 --chrome-h / --footer-h 를 읽는다
 *  (App 의 useChromeMetrics 가 실제로 재서 넣어 준다). */
import { useEffect } from 'react'
import { useBoard } from '../store/boardStore'
import { useUi } from '../store/uiStore'
import { NoteShell } from '../notes/NoteShell'
import './stage.css'

export function NoteStage({ id }: { id: string }) {
  const exists = useBoard((s) => Boolean(s.notes[id]))

  // 펼쳐 둔 노트를 지우면 빈 화면만 남는다. 그때는 캔버스로 돌려보낸다.
  useEffect(() => {
    if (!exists) useUi.getState().collapseNote()
  }, [exists])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 글자를 치는 중의 Esc 는 그 칸이 먼저 쓴다(제목 고치기 취소 등).
      if (e.key !== 'Escape' || e.defaultPrevented) return
      useUi.getState().collapseNote()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!exists) return null

  return (
    <div className="stage">
      <NoteShell id={id} expanded />
    </div>
  )
}
