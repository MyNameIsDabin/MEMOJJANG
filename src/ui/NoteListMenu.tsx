/** 상태 줄에서 왼쪽 아래로 펼쳐지는 노트 목록.
 *
 *  Ctrl+F 의 찾기와 목적이 다르다. 그쪽은 본문까지 뒤져 "그 말이 어디 있나" 를 찾고,
 *  이쪽은 이름만 보고 "그 노트로 가자" 는 쪽이다. 그래서 목록이 늘 펼쳐져 있고
 *  검색칸은 거들 뿐이라 아래에 붙여 둔다 — 여는 자리(상태 줄)에서 가장 가깝다. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useBoard } from '../store/boardStore'
import { useUi } from '../store/uiStore'
import { focusNote } from '../actions/layout'
import type { Note, NoteKind } from '../types'
import { Icon } from './Icon'

const KIND_LABEL: Record<NoteKind, string> = { todo: '할일', memo: '메모', image: '그림', link: '링크' }

/** 이름이 비었을 때 목록에서 알아볼 수 있도록 본문 앞머리를 조금 빌려 온다. */
function subtitleOf(note: Note): string {
  if (note.kind === 'memo') return note.body.trim().split('\n')[0] ?? ''
  if (note.kind === 'todo') return note.items.map((i) => i.text).filter(Boolean).join(', ')
  if (note.kind === 'link') return note.items.map((i) => i.label || i.url).join(', ')
  return note.file
}

export function NoteListMenu({ onClose }: { onClose: () => void }) {
  const notes = useBoard((s) => s.notes)
  const noteIds = useBoard((s) => s.noteIds)
  const selection = useBoard((s) => s.selection)
  const fullscreenId = useUi((s) => s.fullscreenNoteId)

  const [query, setQuery] = useState('')
  /** 화살표·Tab 으로 짚고 있는 줄. 목록은 위로 쌓이므로 0 은 검색칸 바로 위다. */
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const itemsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      // 상태 줄의 여는 단추까지 포함해서 봐야 한 번 더 눌렀을 때 제대로 닫힌다.
      const target = e.target as Node
      if (!ref.current?.contains(target) && !(target as HTMLElement).closest?.('.footer__btn')) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    // 최근에 만든 것이 위로. 목록을 여는 이유는 대개 방금 만든 것을 다시 찾기 위해서다.
    const all = noteIds
      .map((id) => notes[id])
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)
    if (!needle) return all
    return all.filter((n) => n.title.toLowerCase().includes(needle))
  }, [noteIds, notes, query])

  /* 짚어 둔 줄은 맨 아래에서 시작한다 — 손이 있는 검색칸에 가장 가까운 줄이다.
     검색어가 바뀌면 걸린 것이 통째로 달라지므로 다시 아래부터. */
  useEffect(() => {
    setActive(Math.max(0, rows.length - 1))
  }, [query, rows.length])

  // 짚은 줄이 목록 밖으로 나가면 따라 스크롤한다.
  useEffect(() => {
    itemsRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, rows.length])

  const go = (id: string) => {
    focusNote(id)
    onClose()
  }

  /* 화살표는 화면에서 보이는 방향 그대로 움직인다. Tab 은 ↓, Shift+Tab 은 ↑ 와 같다.
     양끝에서는 돌아 나오므로 어느 쪽으로 눌러도 목록 전체에 닿는다.
     Tab 의 기본 동작은 막아야 한다 — 안 그러면 포커스가 목록 밖으로 새어 나간다. */
  const step = (delta: number) => {
    if (!rows.length) return
    setActive((at) => (at + delta + rows.length) % rows.length)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault()
      step(-1)
    } else if (e.key === 'ArrowDown' || e.key === 'Tab') {
      e.preventDefault()
      step(1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[active]
      if (row) go(row.id)
    }
  }

  return (
    <div className="notelist bevel-out" ref={ref} role="dialog" aria-label="노트 목록">
      <div className="notelist__items" ref={itemsRef}>
        {rows.length === 0 && (
          <p className="notelist__empty">
            {query.trim() ? '그런 이름의 노트가 없습니다.' : '아직 노트가 없습니다.'}
          </p>
        )}
        {rows.map((note, i) => (
          <button
            key={note.id}
            type="button"
            data-active={i === active}
            // 지금 짚은 줄과, 지금 보고 있는 노트는 다른 뜻이라 표시도 따로 준다.
            className={[
              'notelist__item',
              i === active ? 'notelist__item--on' : '',
              note.id === (fullscreenId ?? selection[0]) ? 'notelist__item--cur' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => go(note.id)}
            onMouseEnter={() => setActive(i)}
          >
            <span className="notelist__kind">{KIND_LABEL[note.kind]}</span>
            <span className="notelist__title">{note.title}</span>
            <span className="notelist__sub">{subtitleOf(note) || '(비어 있음)'}</span>
          </button>
        ))}
      </div>

      <div className="notelist__find">
        <Icon name="search" />
        <input
          className="notelist__input"
          autoFocus
          value={query}
          placeholder="노트 이름으로 찾기…"
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <span className="notelist__count">{rows.length}개</span>
      </div>
    </div>
  )
}
