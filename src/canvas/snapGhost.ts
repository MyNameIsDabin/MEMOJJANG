/** 격자에 붙일 자리를 미리 보여 주는 실루엣.
 *
 *  노트를 끄는 동안 "손을 떼면 여기로 간다" 를 알려 준다. 스냅은 놓는 순간에만 일어나므로
 *  이게 없으면 노트가 어디로 튈지 떼어 봐야 안다.
 *
 *  보드 스토어에 넣지 않고 따로 두는 이유: 끄는 내내 초당 수십 번 바뀌는데, 보드에 넣으면
 *  그때마다 캔버스 전체가 다시 그려진다. 여기 있으면 실루엣만 다시 그린다. */
import { create } from 'zustand'

export interface Ghost {
  x: number
  y: number
  w: number
  h: number
}

interface GhostState {
  ghosts: Ghost[]
  show: (ghosts: Ghost[]) => void
  hide: () => void
}

export const useSnapGhost = create<GhostState>()((set) => ({
  ghosts: [],
  show: (ghosts) => set({ ghosts }),
  hide: () => set((s) => (s.ghosts.length ? { ghosts: [] } : s)),
}))

/** 격자에 붙인 값. 자리와 크기 모두 이걸로 떨군다. */
export const snapTo = (value: number, grid: number) => Math.round(value / grid) * grid
