/** 보드 안 내용 찾기. 결과를 누르면 그 노트가 화면 한가운데로 온다. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { searchNotes } from '../actions/search'
import { focusNote } from '../actions/layout'
import { useBoard } from '../store/boardStore'
import type { NoteKind } from '../types'
import { Icon } from './Icon'
import { useT, type MessageKey } from '../i18n'
import './search.css'

const KIND_LABEL: Record<NoteKind, MessageKey> = {
  todo: 'kind.todo',
  memo: 'kind.memo',
  image: 'kind.image',
  link: 'kind.link',
}

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const say = useT()

  // 노트가 바뀌면 결과도 따라 바뀌어야 한다. 패널은 잠깐 떠 있다 사라지므로
  // 통째로 구독해도 부담이 없다.
  const notes = useBoard((s) => s.notes)
  const hits = useMemo(() => searchNotes(query), [query, notes])

  // 검색어가 바뀌면 첫 결과부터 다시 본다.
  useEffect(() => setActive(0), [query])

  // 고른 항목이 목록 밖으로 나가면 따라 스크롤한다.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, hits.length])

  const go = (index: number) => {
    const hit = hits[index]
    if (!hit) return
    setActive(index)
    focusNote(hit.id)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (!hits.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      go((active + 1) % hits.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      go((active - 1 + hits.length) % hits.length)
    } else if (e.key === 'Enter') {
      // 화살표로 훑다가 Enter 로 결정한다. 고른 노트로 간 다음 창을 접는다.
      e.preventDefault()
      go(active)
      onClose()
    }
  }

  return (
    <div className="search" onKeyDown={onKeyDown}>
      <div className="search__row">
        <input
          className="search__input"
          autoFocus
          value={query}
          placeholder={say('search.placeholder')}
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="search__count">
          {query.trim() ? (hits.length ? say('search.count', { n: hits.length }) : say('search.none')) : ''}
        </span>
        <button type="button" className="search__close" title={say('search.close')} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      {hits.length > 0 && (
        <div className="search__list" ref={listRef}>
          {hits.map((hit, i) => (
            <button
              key={hit.id}
              type="button"
              data-active={i === active}
              className={`search__hit${i === active ? ' search__hit--on' : ''}`}
              onClick={() => go(i)}
            >
              <span className="search__kind">{say(KIND_LABEL[hit.kind])}</span>
              <span className="search__title">{hit.title}</span>
              <span className="search__snippet">{hit.snippet || say('search.noBody')}</span>
            </button>
          ))}
        </div>
      )}

      {query.trim() && !hits.length && <p className="search__empty">{say('search.empty')}</p>}
    </div>
  )
}
