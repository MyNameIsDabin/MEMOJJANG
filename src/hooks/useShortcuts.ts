/** 전역 단축키. 글자를 치는 중일 때는 대부분 비켜준다. */
import { useEffect } from 'react'
import { useBoard } from '../store/boardStore'
import { useUi } from '../store/uiStore'
import { dropPoint } from '../canvas/pointer'
import { handlePasteEvent, schedulePasteFallback } from '../actions/paste'
import { arrangeGrid, zoomToFit } from '../actions/layout'
import { isTextField } from '../utils/dom'

export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const inField = isTextField(e.target)
      const board = useBoard.getState()

      // 노트 추가는 입력 중에도 받는다 — 흐름이 끊기지 않도록.
      if (mod && !e.shiftKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault()
        board.addNote(({ 1: 'todo', 2: 'memo', 3: 'link' } as const)[e.key], dropPoint())
        return
      }

      if (mod && e.key === '0') {
        e.preventDefault()
        if (e.shiftKey) zoomToFit()
        else board.setViewport((vp) => ({ ...vp, zoom: 1 }))
        return
      }

      // 찾기는 글자를 치는 중에도 열려야 한다 — 메모를 쓰다 딴 노트를 찾는 일이 흔하다.
      // 열려 있을 때 다시 누르면 닫는다. 같은 키로 여닫는 편이 손에 붙는다.
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        useUi.getState().toggleSearch()
        return
      }

      // 노트 목록도 마찬가지. Shift 가 붙으면 전역 단축키(기본 Ctrl+Shift+Space)이므로 비켜준다.
      if (mod && !e.shiftKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault()
        useUi.getState().toggleNoteList()
        return
      }

      // 이름 바꾸기. 글자를 치는 중에도 받는다 — 본문을 쓰다 제목을 고치는 일이 흔하다.
      // 여러 개를 골라 뒀으면 어느 것인지 알 수 없으므로 가만히 둔다.
      if (e.key === 'F2' && board.selection.length === 1) {
        e.preventDefault()
        useUi.getState().startRenaming(board.selection[0])
        return
      }

      // 아래부터는 입력 칸의 기본 동작(실행취소·전체선택·글자삭제·붙여넣기)을 건드리면 안 된다.
      if (inField) return

      if (mod && e.key.toLowerCase() === 'v') {
        // 막지 않는다 — 웹뷰가 paste 이벤트를 쏴 주면 그쪽이 더 정확하다.
        // 안 쏴 줄 때만 폴백이 클립보드를 직접 읽는다.
        schedulePasteFallback(dropPoint())
        return
      }

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) board.redo()
        else board.undo()
        return
      }

      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        board.redo()
        return
      }

      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        board.select(board.noteIds)
        return
      }

      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        board.duplicateNotes(board.selection)
        return
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        arrangeGrid(board.selection)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!board.selection.length) return
        e.preventDefault()
        board.removeNotes(board.selection)
        return
      }

      if (e.key === 'Escape') {
        // 열린 패널이 있으면 그것부터 닫는다. 선택 해제는 그 다음.
        if (useUi.getState().search) useUi.getState().closeSearch()
        else board.clearSelection()
      }
    }

    const onPaste = (e: ClipboardEvent) => handlePasteEvent(e, dropPoint())

    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
    }
  }, [])
}
