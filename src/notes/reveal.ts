/** 찾은 글자를 노트 안에서 보여 주기.
 *
 *  노트로 화면을 옮기는 것만으로는 모자란다 — 글이 길면 찾은 말은 노트 안 칸을 한참
 *  굴려야 나온다. 그래서 찾기 창은 "이 노트의 여기" 를 부탁만 해 두고, 그 노트의 본문이
 *  자기 칸을 굴린 뒤 그 자리를 잠깐 반짝인다. 칸이 어떻게 생겼는지는 본문만 안다.
 *
 *  부탁을 곧장 부르지 않고 가게 두는 이유: 부탁하는 순간에는 본문이 아직 제자리에 없다.
 *  화면을 옮긴 것은 다음 렌더에야 노트 자리에 반영되고, 펼쳐 보기 중이면 무대에 다음 노트가
 *  올라오는 것도 다음 렌더다. 본문이 그려진 뒤 스스로 집어 간다. */
import { useLayoutEffect, useRef } from 'react'
import { create } from 'zustand'
import { useUi } from '../store/uiStore'
import { bringIntoView, type ScreenRect } from '../actions/layout'

/** 노트 안의 어느 글자인가. 노트 종류마다 글이 담긴 모양이 달라 짚는 법도 다르다. */
export type Spot =
  /** 메모 본문의 [at, at + length) */
  | { field: 'body'; at: number; length: number }
  /** 할 일·바로가기의 한 항목. at 은 그 항목 글 안에서의 자리다. */
  | { field: 'item'; itemId: string; at: number; length: number }

export interface RevealRequest {
  noteId: string
  spot: Spot
  /** 찾은 말(소문자). 원문과 화면 글이 다른 보기(정리해 보여 주는 JSON)에서 다시 찾는 데 쓴다. */
  needle: string
  /** Enter 로 고른 것이다. 반짝이고 끝내지 않고, 그 글자를 골라 둔 채 캐럿을 넣는다.
   *  화살표로 훑을 때는 그러면 안 된다 — 캐럿을 가져가면 찾기 칸이 화살표를 못 받는다. */
  select: boolean
  issuedAt: number
}

/** 이보다 오래된 부탁은 버린다. 접혀 있던 노트를 한참 뒤에 펼쳤는데 뜬금없이 반짝이면 안 된다. */
export const STALE_MS = 1000

/** 반짝임이 떠 있는 시간. CSS 의 find-blink 와 길이를 맞춘다. */
export const FLASH_MS = 1800

const useRevealStore = create<{ request: RevealRequest | null }>(() => ({ request: null }))

/** 같은 자리를 다시 골라도 매번 새 객체라, 본문은 그때마다 다시 굴리고 반짝인다. */
export function requestReveal(req: Omit<RevealRequest, 'issuedAt'>): void {
  useRevealStore.setState({ request: { ...req, issuedAt: Date.now() } })
}

/** 본문이 부르는 쪽. 이 노트 앞으로 온 부탁이 있으면 handle 을 한 번 부른다.
 *
 *  handle 이 받는 show 는 "굴리고 났더니 찾은 글자가 화면 여기 있다" 를 알리는 곳이다.
 *  노트가 창보다 커서 그 자리가 창 밖이면 캔버스를 그쪽으로 민다. */
export function useReveal(
  noteId: string,
  expanded: boolean,
  handle: (req: RevealRequest, show: (rect: ScreenRect) => void) => void,
): void {
  const request = useRevealStore((s) => (s.request?.noteId === noteId ? s.request : null))
  // 펼쳐 보는 중이면 같은 노트가 캔버스와 무대에 하나씩 있다. 보이는 쪽만 움직인다.
  const onStage = useUi((s) => s.fullscreenNoteId === noteId)
  const primary = expanded || !onStage

  const latest = useRef(handle)
  latest.current = handle

  /* 칠하기 전에 굴려야 노트가 한 번 가운데 왔다가 다시 튀는 것이 보이지 않는다.
     "이미 처리함" 표시를 따로 두지 않는다 — 개발 모드(StrictMode)는 효과를 한 번 뜯었다 다시 붙이는데,
     표시가 있으면 곧 버려질 첫 번째 에디터에 칠하고 진짜 에디터에서는 건너뛴다.
     이 효과는 부탁이 바뀔 때만 다시 돌고, 오래된 부탁은 시간으로 걸러진다. */
  useLayoutEffect(() => {
    if (!request || !primary) return
    if (Date.now() - request.issuedAt > STALE_MS) return
    // 펼쳐 놓았을 때는 무대가 창을 다 쓰므로 캔버스를 밀 일이 없다.
    latest.current(request, expanded ? () => {} : bringIntoView)
  }, [request, primary, expanded])
}

/* ── 굴리기 ────────────────────────────────────────────────────────── */

/** 캔버스 확대율은 transform 으로 걸린다. 화면 좌표(getBoundingClientRect)와
 *  레이아웃 좌표(scrollTop 따위)를 오갈 때 이 값으로 나누고 곱한다. */
export function scaleOf(el: HTMLElement): number {
  const w = el.offsetWidth
  return w > 0 ? el.getBoundingClientRect().width / w : 1
}

/** 칸의 보이는 쪽 가장자리에서 이만큼(비율) 안쪽까지 들어와 있어야 "보인다" 고 친다.
 *  끝에 겨우 걸린 것을 보인다고 치면 눈이 찾지 못한다. */
const EDGE = 0.12

/** 화면 좌표의 네모가 노트 안의 굴리는 칸들에서 보이도록 굴린다. 굴린 뒤의 화면 자리를 돌려준다.
 *
 *  노트 바깥까지 올라가지 않는다 — 캔버스(.board)는 overflow: hidden 이라 브라우저가
 *  거기까지 굴려 버리면 화면이 viewport 상태와 어긋난 채 밀린다. 같은 이유로
 *  overflow: auto / scroll 인 칸만 굴린다. */
export function scrollIntoNote(from: Node, rect: ScreenRect): ScreenRect {
  let r = rect
  const first = from instanceof HTMLElement ? from : from.parentElement
  const stop = first?.closest('.note')
  for (let el = first; el && el !== stop; el = el.parentElement) {
    const style = getComputedStyle(el)
    const canY = /auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight
    const canX = /auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth
    if (canY || canX) r = scrollToSee(el, r, canX, canY)
  }
  return r
}

function scrollToSee(el: HTMLElement, r: ScreenRect, canX: boolean, canY: boolean): ScreenRect {
  const k = scaleOf(el)
  const frame = el.getBoundingClientRect()
  const left = frame.left + el.clientLeft * k
  const top = frame.top + el.clientTop * k
  const width = el.clientWidth * k
  const height = el.clientHeight * k
  let dx = 0
  let dy = 0

  if (canY && !fits(r.top, r.bottom, top, height)) {
    const before = el.scrollTop
    el.scrollTop = before + ((r.top + r.bottom) / 2 - (top + height / 2)) / k
    dy = (el.scrollTop - before) * k
  }
  // 가로는 가운데까지 끌고 오지 않는다. 줄 첫머리가 함께 보이는 편이 읽기 쉽다.
  if (canX && !fits(r.left, r.right, left, width)) {
    const before = el.scrollLeft
    el.scrollLeft = before + (r.left - (left + width / 3)) / k
    dx = (el.scrollLeft - before) * k
  }
  return { left: r.left - dx, right: r.right - dx, top: r.top - dy, bottom: r.bottom - dy }
}

function fits(a: number, b: number, start: number, size: number): boolean {
  return a >= start + size * EDGE && b <= start + size * (1 - EDGE)
}

/* ── 반짝이기 ──────────────────────────────────────────────────────── */

/** 항목 하나를 통째로 반짝인다. 할 일·바로가기 줄처럼 짧은 것에 쓴다.
 *  React 가 쥔 className 을 건드리지 않으려고 따로 하나만 붙였다 뗀다. */
export function flashElement(el: HTMLElement): void {
  el.classList.remove('found-flash')
  // 같은 줄을 연달아 찾을 때도 처음부터 다시 깜빡이게 한다.
  void el.offsetWidth
  el.classList.add('found-flash')
  window.setTimeout(() => el.classList.remove('found-flash'), FLASH_MS)
}

const HIGHLIGHT = 'memo-find'
let highlightTimer = 0

/** 그려 놓은 글(정리한 JSON 같은 것) 안에서 needle 을 다시 찾아 칠한다. 칠한 자리를 돌려준다.
 *
 *  원문 자리로는 짚을 수 없다 — 들여쓰기를 새로 해서 보여 주므로 글자 자리가 원문과 다르다.
 *  글자를 감싸는 요소를 끼워 넣지 않고 CSS Highlight 로 칠한다. React 가 그린 것을 건드리면
 *  다음 렌더에서 엉킨다. */
export function flashText(root: HTMLElement, needle: string): { rect: ScreenRect; node: Node } | null {
  // 찾은 말이 여러 조각(<span>)에 걸칠 수 있어 글자를 이어 붙인 뒤 찾고, 자리를 조각으로 되짚는다.
  if (!needle) return null

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  const starts: number[] = []
  let all = ''
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push(n as Text)
    starts.push(all.length)
    all += (n as Text).data
  }

  const at = all.toLowerCase().indexOf(needle)
  if (at < 0) return null

  const locate = (pos: number): [Text, number] => {
    let i = nodes.length - 1
    while (i > 0 && starts[i] > pos) i -= 1
    return [nodes[i], pos - starts[i]]
  }
  const range = document.createRange()
  range.setStart(...locate(at))
  range.setEnd(...locate(at + needle.length))

  // 오래된 WebView 에는 없을 수 있다. 칠은 못 해도 굴리는 것은 한다.
  if (typeof Highlight !== 'undefined' && CSS.highlights) {
    CSS.highlights.set(HIGHLIGHT, new Highlight(range))
    window.clearTimeout(highlightTimer)
    highlightTimer = window.setTimeout(() => CSS.highlights.delete(HIGHLIGHT), FLASH_MS)
  }
  return { rect: range.getBoundingClientRect(), node: range.startContainer }
}
