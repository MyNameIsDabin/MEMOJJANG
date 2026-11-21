/** 마크다운 편집기 안에서 찾은 글자를 보여 주기 — 굴려서 데려오고 잠깐 반짝인다.
 *
 *  CodeMirror 의 scrollIntoView 를 쓰지 않는다. 그것은 굴릴 수 있는 조상을 문서 끝까지
 *  전부 굴리는데, 캔버스(.board)도 overflow: hidden 일 뿐 굴릴 수는 있는 칸이라
 *  캔버스 전체가 viewport 상태와 어긋난 채 밀려 버린다. 그래서 편집기 칸 하나만 직접 굴린다. */
import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'
import type { ScreenRect } from '../actions/layout'
import { FLASH_MS } from './reveal'

/** 켜기에는 자리를, 끄기에는 null 을 준다. id 는 늦게 도착한 끄기가 새 반짝임을 지우지 않게 한다. */
const setFound = StateEffect.define<{ id: number; from: number; to: number } | { id: number; off: true }>()

const foundMark = Decoration.mark({ class: 'cm-find-flash' })

const foundField = StateField.define<{ id: number; deco: DecorationSet }>({
  create: () => ({ id: 0, deco: Decoration.none }),
  update(value, tr) {
    for (const e of tr.effects) {
      if (!e.is(setFound)) continue
      if ('off' in e.value) {
        if (e.value.id === value.id) return { id: value.id, deco: Decoration.none }
      } else {
        return { id: e.value.id, deco: Decoration.set([foundMark.range(e.value.from, e.value.to)]) }
      }
    }
    // 글을 고치기 시작했으면 반짝임은 할 일을 다 했다.
    return tr.docChanged ? { id: value.id, deco: Decoration.none } : value
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
})

export const findMark = foundField

let nextId = 0

export function revealInEditor(
  view: EditorView,
  at: number,
  length: number,
  select: boolean,
  show: (rect: ScreenRect) => void,
): void {
  // 찾은 뒤에 글이 바뀌었을 수 있다. 문서 밖을 짚으면 CodeMirror 가 예외를 던진다.
  const end = view.state.doc.length
  const from = Math.min(Math.max(0, at), end)
  const to = Math.min(from + Math.max(0, length), end)

  nextId += 1
  const id = nextId
  view.dispatch({
    effects: from < to ? setFound.of({ id, from, to }) : [],
    selection: select ? { anchor: from, head: to } : undefined,
  })
  if (select) view.focus()

  // 1차: 높이 지도로 어림잡아 바로 굴린다. 그 줄이 아직 그려지지 않았어도 높이는 안다.
  // 접어 쓴 긴 문단은 한 덩어리라, 덩어리 안에서 몇 번째 글자인지로 비례해 짚는다.
  const scroller = view.scrollDOM
  const block = view.lineBlockAt(from)
  const share = block.length > 0 ? (from - block.from) / block.length : 0
  const y = view.documentPadding.top + block.top + block.height * share
  if (y < scroller.scrollTop || y > scroller.scrollTop + scroller.clientHeight) {
    scroller.scrollTop = y - scroller.clientHeight / 2
  }

  // 2차: 그려진 뒤 실제 자리를 재서 바로잡는다.
  refine(view, from, 3, show)

  window.setTimeout(() => {
    if (view.dom.isConnected) view.dispatch({ effects: setFound.of({ id, off: true }) })
  }, FLASH_MS)
}

/** 굴리고 나면 CodeMirror 가 새로 보이는 줄을 그린다. 그 다음 판에서 재야 자리가 나온다. */
function refine(view: EditorView, pos: number, tries: number, show: (rect: ScreenRect) => void): void {
  view.requestMeasure({
    read(v) {
      const at = v.coordsAtPos(pos)
      return at ? { at, frame: v.scrollDOM.getBoundingClientRect() } : null
    },
    write(m, v) {
      if (!v.dom.isConnected) return
      if (!m) {
        // 끝내 그려지지 않으면(노트가 창보다 커서 그 줄이 창 밖이면) 높이 지도로 어림한 자리를 준다.
        if (tries > 0) window.requestAnimationFrame(() => refine(v, pos, tries - 1, show))
        else show(estimate(v, pos))
        return
      }

      const s = v.scrollDOM
      const k = v.scaleY || 1
      const height = s.clientHeight * k
      const mid = (m.at.top + m.at.bottom) / 2
      const inside = mid >= m.frame.top + height * 0.12 && mid <= m.frame.top + height * 0.88
      if (!inside && s.scrollHeight > s.clientHeight) {
        const before = s.scrollTop
        s.scrollTop = before + (mid - (m.frame.top + height / 2)) / k
        if (s.scrollTop !== before && tries > 0) {
          window.requestAnimationFrame(() => refine(v, pos, tries - 1, show))
          return
        }
      }
      show(m.at)
    },
  })
}

function estimate(view: EditorView, pos: number): ScreenRect {
  const block = view.lineBlockAt(pos)
  const share = block.length > 0 ? (pos - block.from) / block.length : 0
  const k = view.scaleY || 1
  const top = view.documentTop + (block.top + block.height * share) * k
  const box = view.contentDOM.getBoundingClientRect()
  return { left: box.left, right: box.left + 1, top, bottom: top + view.defaultLineHeight * k }
}
