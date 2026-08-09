/** 겹쳐 뜨는 패널들의 열림 상태. 도구막대·단축키·패널 자신이 모두 건드리므로
 *  props 로 물려 내리는 대신 한 군데 모아둔다.
 *
 *  여기 있는 것은 전부 그때그때의 화면 상태다 — 파일에 남지 않는다. */
import { create } from 'zustand'

interface UiState {
  search: boolean
  settings: boolean
  /** 아래 상태 줄에서 펼치는 노트 목록 */
  noteList: boolean
  /** 지금 제목을 고치고 있는 노트. 단축키(F2)와 노트의 ✎ 단추가 함께 쓴다. */
  renamingNoteId: string | null
  /** 화면 가득 펼쳐 놓은 노트. 없으면 평소대로 캔버스만 보인다. */
  fullscreenNoteId: string | null

  /** 꾸미기 모드 — 노트는 잠기고 스티커만 만진다. */
  decorating: boolean
  /** 지금 손보고 있는 스티커. 손잡이가 이 스티커에만 붙는다. */
  activeStickerId: string | null

  openSearch: () => void
  closeSearch: () => void
  toggleSearch: () => void
  openSettings: () => void
  closeSettings: () => void
  toggleNoteList: () => void
  closeNoteList: () => void
  startRenaming: (id: string) => void
  stopRenaming: () => void
  expandNote: (id: string) => void
  collapseNote: () => void
  /** 펼쳐 보고 있을 때만 대상을 갈아 끼운다. 아니면 아무 일도 하지 않는다. */
  followFullscreen: (id: string) => void

  toggleDecorating: () => void
  stopDecorating: () => void
  pickSticker: (id: string | null) => void
}

export const useUi = create<UiState>()((set) => ({
  search: false,
  settings: false,
  noteList: false,
  renamingNoteId: null,
  fullscreenNoteId: null,
  decorating: false,
  activeStickerId: null,

  // 검색과 설정이 동시에 뜨면 서로 가린다. 한 번에 하나만.
  openSearch: () => set({ search: true, settings: false, noteList: false }),
  closeSearch: () => set({ search: false }),
  toggleSearch: () =>
    set((s) => (s.search ? { search: false } : { search: true, settings: false, noteList: false })),
  openSettings: () => set({ settings: true, search: false, noteList: false }),
  closeSettings: () => set({ settings: false }),

  toggleNoteList: () =>
    set((s) => (s.noteList ? { noteList: false } : { noteList: true, search: false, settings: false })),
  closeNoteList: () => set({ noteList: false }),

  startRenaming: (id) => set({ renamingNoteId: id }),
  stopRenaming: () => set({ renamingNoteId: null }),

  expandNote: (id) => set({ fullscreenNoteId: id }),
  collapseNote: () => set({ fullscreenNoteId: null }),
  followFullscreen: (id) => set((s) => (s.fullscreenNoteId ? { fullscreenNoteId: id } : {})),

  // 꾸미는 동안에는 노트를 펼쳐 놓을 수 없다 — 캔버스가 안 보이면 붙일 자리도 없다.
  toggleDecorating: () =>
    set((s) => ({
      decorating: !s.decorating,
      activeStickerId: null,
      fullscreenNoteId: s.decorating ? s.fullscreenNoteId : null,
      search: false,
      noteList: false,
    })),
  stopDecorating: () => set({ decorating: false, activeStickerId: null }),
  pickSticker: (id) => set({ activeStickerId: id }),
}))
