/** 마크다운을 **그려 둔 채로** 고치는 칸.
 *
 *  예전에는 원문과 결과가 따로였다 — 두 번 눌러 원문으로 들어가면 그리는 것이 통째로 사라져,
 *  고치는 동안에는 결과를 볼 수 없었다. 여기서는 캐럿이 놓인 **그 한 줄만** 원문으로 드러나고
 *  나머지는 계속 그려져 있다. 줄을 떠나는 순간 그 줄도 곧바로 그려진다.
 *
 *  고치는 칸은 늘 하나뿐인 진짜 <textarea> 다. 여러 개를 띄우거나 contentEditable 로 가면
 *  한글 조합·되돌리기·붙여넣기가 모두 내 몫이 된다 — 그건 브라우저가 훨씬 잘한다. */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Markdown } from './Markdown'
import { useT } from '../i18n'

export function LiveMarkdown({ text, onChange }: { text: string; onChange: (next: string) => void }) {
  const say = useT()
  const [line, setLine] = useState<number | null>(null)
  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  /** 다음에 그린 뒤 캐럿을 놓을 자리. 한 번 쓰고 비운다 —
   *  글쇠를 칠 때마다 자리를 잡아 주면 한글 조합이 끊어진다. 줄이 갈리거나 옮길 때만 손댄다. */
  const wanted = useRef<number | null>(null)
  /** 캐럿이 지금 어디 있는지. `# ` 이나 `- ` 를 치면 그 줄이 문단에서 제목·목록으로 바뀌고,
   *  React 는 태그가 달라지면 칸을 버리고 새로 만든다 — 그때 포커스와 캐럿이 함께 날아간다.
   *  되돌려 놓으려면 어디였는지 늘 적어 두는 수밖에 없다. */
  const caret = useRef(0)

  const lines = useMemo(() => text.split(/\r?\n/), [text])
  // 밖에서 글이 줄어들 수도 있다. 없는 줄을 가리킨 채로 두지 않는다.
  const at = line === null ? null : Math.min(line, lines.length - 1)

  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    // 글이 길어지면 칸도 같이 자란다. auto 로 되돌리지 않으면 한 번 커진 칸이 줄지 않는다.
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
    // 옮기기로 한 자리가 있으면 그리로.
    if (wanted.current !== null) {
      caret.current = wanted.current
      wanted.current = null
      el.focus()
      el.setSelectionRange(caret.current, caret.current)
      return
    }

    /* 칸이 갈아 끼워져 포커스가 허공에 떨어졌으면 주워 온다.
       **아무도 가져가지 않았을 때만** 이다 — 그냥 끌어오면 아래 정보줄 단추를 누른
       사람에게서 포커스를 도로 뺏는다. */
    const holder = document.activeElement
    if (el !== holder && (!holder || holder === document.body)) {
      const to = Math.min(caret.current, el.value.length)
      el.focus()
      el.setSelectionRange(to, to)
    }
  })

  const activate = (n: number, offset: number) => {
    wanted.current = offset
    setLine(n)
  }

  const onEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (at === null) return
    const value = e.target.value
    caret.current = e.target.selectionStart
    const parts = value.split('\n')
    // 줄이 갈렸을 때만 캐럿을 따라간다. 그냥 치는 동안에는 브라우저가 알아서 지킨다.
    if (parts.length > 1) {
      const head = value.slice(0, e.target.selectionStart).split('\n')
      wanted.current = head[head.length - 1].length
      setLine(at + head.length - 1)
    }
    onChange([...lines.slice(0, at), ...parts, ...lines.slice(at + 1)].join('\n'))
  }

  /** 줄 끝에서 누른 화살표·지우기는 옆 줄로 넘어간다. 안쪽에서는 브라우저에 맡긴다. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (at === null) return
    const el = e.currentTarget
    const head = el.selectionStart === 0 && el.selectionEnd === 0
    const tail = el.selectionStart === el.value.length && el.selectionEnd === el.selectionStart

    // 목록 안에서 줄을 바꾸면 표식을 이어 붙인다. 빈 항목에서 한 번 더 누르면 목록에서 빠져나온다.
    const item = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[at])
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && item && tail) {
      e.preventDefault()
      if (!item[3].trim()) {
        activate(at, 0)
        onChange([...lines.slice(0, at), '', ...lines.slice(at + 1)].join('\n'))
        return
      }
      const mark = /^\d+\.$/.test(item[2]) ? `${parseInt(item[2], 10) + 1}.` : item[2]
      const next = `${item[1]}${mark} `
      activate(at + 1, next.length)
      onChange([...lines.slice(0, at + 1), next, ...lines.slice(at + 1)].join('\n'))
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setLine(null)
      el.blur()
    } else if (e.key === 'ArrowUp' && head && at > 0) {
      e.preventDefault()
      activate(at - 1, lines[at - 1].length)
    } else if (e.key === 'ArrowDown' && tail && at < lines.length - 1) {
      e.preventDefault()
      activate(at + 1, 0)
    } else if (e.key === 'Backspace' && head && at > 0) {
      e.preventDefault()
      activate(at - 1, lines[at - 1].length)
      onChange([...lines.slice(0, at - 1), lines[at - 1] + lines[at], ...lines.slice(at + 1)].join('\n'))
    } else if (e.key === 'Delete' && tail && at < lines.length - 1) {
      e.preventDefault()
      onChange([...lines.slice(0, at), lines[at] + lines[at + 1], ...lines.slice(at + 2)].join('\n'))
    }
  }

  /** 그려진 글을 누르면 그 자리에 캐럿을 놓는다. */
  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (areaRef.current?.contains(target)) return
    // 링크는 눌러서 여는 것이지 고치는 것이 아니다.
    if (target.closest('.md__link')) return
    // 잡아 끌어 고른 참이면 그대로 둔다. 캐럿을 옮기면 고른 것이 곧바로 풀린다.
    const picked = window.getSelection()
    if (picked && !picked.isCollapsed) return

    const host = target.closest('[data-line]') as HTMLElement | null
    if (!host) {
      // 글 아래 빈 자리를 눌렀다. 맨 끝에서 이어 쓰는 것이 자연스럽다.
      const last = lines.length - 1
      activate(last, lines[last].length)
      return
    }

    const from = Number(host.dataset.line)
    const span = Number(host.dataset.span) || 1
    const src = lines.slice(from, from + span).join('\n')
    const shown = shownPrefix(host, e.clientX, e.clientY)
    const offset = shown === null ? src.length : alignToSource(src, shown)
    const before = src.slice(0, offset)
    const skipped = before.split('\n').length - 1
    activate(from + skipped, before.length - (before.lastIndexOf('\n') + 1))
  }

  const raw = (n: number) => (
    <textarea
      ref={areaRef}
      className="md__raw"
      rows={1}
      value={lines[n] ?? ''}
      spellCheck={false}
      onChange={onEdit}
      onKeyDown={onKeyDown}
      onSelect={(e) => {
        caret.current = e.currentTarget.selectionStart
      }}
      onBlur={(e) => {
        const el = e.currentTarget
        // 칸이 갈아 끼워지며 난 blur 는 사람이 손을 뗀 것이 아니다. 고치던 자리를 지킨다.
        if (!el.isConnected) return
        // 노트 안에서 오간 것뿐이어도 그대로 둔다 — 아래 정보줄 단추가 자기 일을 한다.
        const note = el.closest('.note')
        if (!note?.contains(e.relatedTarget as Node | null)) setLine(null)
      }}
    />
  )

  return (
    <div
      className="md__live"
      // 휠 클릭은 캔버스가 화면을 옮기는 데 써야 하므로 막지 않는다.
      onPointerDown={(e) => {
        if (e.button === 0) e.stopPropagation()
      }}
      onClick={onClick}
    >
      {at === null && !text.trim() && <p className="md__empty">{say('memo.placeholder')}</p>}
      <Markdown text={text} raw={at === null ? undefined : { line: at, render: raw }} />
    </div>
  )
}

/** 누른 자리까지의 **그려진** 글. 원문에는 표시 문자가 더 있어 길이가 다르다. */
function shownPrefix(host: HTMLElement, x: number, y: number): string | null {
  const point = document.caretRangeFromPoint?.(x, y)
  if (!point || !host.contains(point.startContainer)) return null
  const range = document.createRange()
  range.selectNodeContents(host)
  range.setEnd(point.startContainer, point.startOffset)
  return range.toString()
}

/** 그려진 글의 앞부분이 원문에서는 어디까지인지 짚는다.
 *  원문에만 있는 표시 문자(`#`, `**`, 목록 기호…)를 건너뛰며 한 글자씩 맞춰 나간다.
 *  정확한 역변환은 아니지만, 누른 자리를 한 글자 안쪽으로 짚어 주면 충분하다. */
function alignToSource(src: string, shown: string): number {
  let i = 0
  for (const ch of shown) {
    while (i < src.length && src[i] !== ch) i += 1
    if (i < src.length) i += 1
  }
  return i
}
