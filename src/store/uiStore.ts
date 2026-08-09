/** 겹쳐 뜨는 패널들의 열림 상태. 도구막대·단축키·패널 자신이 모두 건드리므로
 *  props 로 물려 내리는 대신 한 군데 모아둔다. */
import { create } from 'zustand'

interface UiState {
  search: boolean
  settings: boolean
  /** 지금 제목을 고치고 있는 노트. 단축키(F2)와 노트의 ✎ 단추가 함께 쓴다. */
  renamingNoteId: string | null

  openSearch: () => void
  closeSearch: () => void
  toggleSearch: () => void
  openSettings: () => void
  closeSettings: () => void
  startRenaming: (id: string) => void
  stopRenaming: () => void
}

export const useUi = create<UiState>()((set) => ({
  search: false,
  settings: false,
  renamingNoteId: null,

  // 검색과 설정이 동시에 뜨면 서로 가린다. 한 번에 하나만.
  openSearch: () => set({ search: true, settings: false }),
  closeSearch: () => set({ search: false }),
  toggleSearch: () => set((s) => (s.search ? { search: false } : { search: true, settings: false })),
  openSettings: () => set({ settings: true, search: false }),
  closeSettings: () => set({ settings: false }),

  startRenaming: (id) => set({ renamingNoteId: id }),
  stopRenaming: () => set({ renamingNoteId: null }),
}))
