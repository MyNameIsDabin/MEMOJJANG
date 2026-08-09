/** 보드 상태. 노트는 id -> Note 맵으로 들고 있어서
 *  하나를 옮겨도 나머지 노트가 리렌더되지 않는다(노트마다 selector 구독). */
import { create } from 'zustand'
import {
  DEFAULT_SIZE,
  MAX_ZOOM,
  MIN_NOTE_H,
  MIN_NOTE_W,
  MIN_ZOOM,
  newId,
  type AccentKey,
  type CanvasDoc,
  type CreatableKind,
  type Note,
  type NoteKind,
  type Viewport,
} from '../types'
import { deleteImage } from '../platform/assets'
import { useSettings } from './settingsStore'
import { detectView } from '../notes/detect'

/** 되돌리기용 스냅샷. 구조 변경(추가/삭제/이동/크기)에만 쌓고 타이핑에는 쌓지 않는다.
 *  글자 되돌리기는 textarea 의 브라우저 기본 실행취소가 이미 해준다. */
interface Snapshot {
  notes: Record<string, Note>
  noteIds: string[]
}

const UNDO_LIMIT = 50

const DEFAULT_ACCENT: Record<NoteKind, AccentKey> = {
  todo: 'mint',
  memo: 'butter',
  image: 'sky',
  link: 'lilac',
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 픽셀 폰트는 정수 배율에서 제일 또렷하다. 근처를 지나갈 때 살짝 붙잡아 준다. */
const ZOOM_SNAPS = [0.5, 1, 2, 3, 4]
const SNAP_TOLERANCE = 0.03

function snapZoom(zoom: number): number {
  for (const s of ZOOM_SNAPS) {
    if (Math.abs(zoom - s) / s < SNAP_TOLERANCE) return s
  }
  return zoom
}

interface BoardState {
  notes: Record<string, Note>
  noteIds: string[]
  viewport: Viewport
  selection: string[]
  /** 캔버스를 다 읽기 전에는 자동 저장이 돌면 안 된다.
   *  캔버스를 갈아 끼우는 동안에도 잠깐 false 가 되어, 옛 내용이 새 파일에 쓰이는 것을 막는다. */
  hydrated: boolean

  past: Snapshot[]
  future: Snapshot[]

  hydrate: (doc: CanvasDoc | null) => void
  /** 캔버스 전환 시작 — 다음 hydrate 까지 자동 저장을 멈춘다. */
  unhydrate: () => void
  /** 파일에 쓸 알맹이. 캔버스 이름은 파일 계층이 붙인다. */
  contents: () => Pick<CanvasDoc, 'notes' | 'viewport'>

  addNote: (kind: CreatableKind, world: { x: number; y: number }) => string
  /** 붙여넣은 글자를 메모로 얹는다. */
  addMemo: (body: string, world: { x: number; y: number }) => string
  /** 붙여넣은 그림을 얹는다. 파일은 이미 저장돼 있어야 한다. */
  addImage: (
    image: { file: string; naturalW: number; naturalH: number },
    world: { x: number; y: number },
  ) => string
  patchNote: (id: string, patch: Partial<Note>) => void
  moveNotes: (ids: string[], dx: number, dy: number) => void
  resizeNote: (id: string, w: number, h: number) => void
  removeNotes: (ids: string[]) => void
  duplicateNotes: (ids: string[]) => void
  raise: (id: string) => void

  setViewport: (vp: Viewport | ((prev: Viewport) => Viewport)) => void
  zoomAt: (screenX: number, screenY: number, factor: number) => void

  select: (ids: string[]) => void
  toggleSelect: (id: string) => void
  clearSelection: () => void

  commit: () => void
  undo: () => void
  redo: () => void
}

/** 이미지는 원본 비례를 지키되 처음 붙일 때 너무 커지지 않게 가둔다. */
function fitImage(naturalW: number, naturalH: number) {
  const MAX = 420
  const MIN = 120
  if (!naturalW || !naturalH) return DEFAULT_SIZE.image
  const scale = Math.min(1, MAX / Math.max(naturalW, naturalH))
  return {
    w: Math.max(MIN, Math.round(naturalW * scale)),
    h: Math.max(MIN, Math.round(naturalH * scale)) + imageChromeHeight(),
  }
}

/** 그림 노트에서 그림이 아닌 부분(제목 표시줄 + 아래 정보줄 + 테두리)의 높이.
 *  원본 비율을 맞출 때 여기에 더해야 위아래로 남는 여백 없이 액자에 딱 찬다.
 *  글자 크기를 키우면 표시줄도 같이 커지므로 배율을 곱해 준다. */
const IMAGE_CHROME_BASE = 46

export function imageChromeHeight(): number {
  return Math.round(IMAGE_CHROME_BASE * useSettings.getState().fontScale)
}

function baseNote(kind: NoteKind, world: { x: number; y: number }, z: number) {
  const now = Date.now()
  const { w, h } = DEFAULT_SIZE[kind]
  return {
    id: newId(),
    kind,
    // 클릭한 지점이 노트의 좌상단이 아니라 중앙 근처가 되도록 살짝 당긴다.
    x: Math.round(world.x - w / 2),
    y: Math.round(world.y - 16),
    w,
    h,
    z,
    accent: DEFAULT_ACCENT[kind],
    collapsed: false,
    createdAt: now,
    updatedAt: now,
  }
}

export const useBoard = create<BoardState>()((set, get) => {
  const topZ = () => {
    const { notes, noteIds } = get()
    return noteIds.reduce((max, id) => Math.max(max, notes[id]?.z ?? 0), 0)
  }

  const snapshot = (): Snapshot => {
    const { notes, noteIds } = get()
    return { notes: { ...notes }, noteIds: [...noteIds] }
  }

  const insert = (note: Note) => {
    get().commit()
    set((s) => ({
      notes: { ...s.notes, [note.id]: note },
      noteIds: [...s.noteIds, note.id],
      selection: [note.id],
    }))
    return note.id
  }

  return {
    notes: {},
    noteIds: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selection: [],
    hydrated: false,
    past: [],
    future: [],

    unhydrate: () => set({ hydrated: false }),

    hydrate: (doc) => {
      if (!doc?.notes) {
        set({ notes: {}, noteIds: [], viewport: { x: 0, y: 0, zoom: 1 }, hydrated: true, past: [], future: [] })
        return
      }
      const notes: Record<string, Note> = {}
      const noteIds: string[] = []
      for (const n of doc.notes) {
        notes[n.id] = n
        noteIds.push(n.id)
      }
      set({
        notes,
        noteIds,
        viewport: doc.viewport ?? { x: 0, y: 0, zoom: 1 },
        selection: [],
        hydrated: true,
        past: [],
        future: [],
      })
    },

    contents: () => {
      const { notes, noteIds, viewport } = get()
      return { notes: noteIds.map((id) => notes[id]).filter(Boolean), viewport }
    },

    addNote: (kind, world) => {
      const base = baseNote(kind, world, topZ() + 1)
      const note: Note =
        kind === 'todo'
          ? { ...base, kind: 'todo', title: '할 일', items: [{ id: newId(), text: '', done: false }] }
          : kind === 'link'
            ? { ...base, kind: 'link', title: '바로가기', items: [] }
            : { ...base, kind: 'memo', title: '메모', body: '' }
      return insert(note)
    },

    addMemo: (body, world) => {
      const base = baseNote('memo', world, topZ() + 1)
      // 붙여넣기로 만들어지는 메모는 내용이 통째로 들어오는 순간이므로 여기서 한 번 살펴본다.
      const { memoAutoDetect, memoUserRules, memoDisabledBuiltins } = useSettings.getState()
      const view =
        memoAutoDetect && body.trim()
          ? detectView(body, { userRules: memoUserRules, disabledBuiltins: memoDisabledBuiltins })
          : 'plain'
      return insert({ ...base, kind: 'memo', title: '메모', body, view })
    },

    addImage: (image, world) => {
      const base = baseNote('image', world, topZ() + 1)
      const size = fitImage(image.naturalW, image.naturalH)
      return insert({
        ...base,
        kind: 'image',
        title: '이미지',
        ...image,
        w: size.w,
        h: size.h,
        // 크기가 바뀌었으니 중앙 정렬을 다시 잡는다.
        x: Math.round(world.x - size.w / 2),
      })
    },

    patchNote: (id, patch) =>
      set((s) => {
        const prev = s.notes[id]
        if (!prev) return s
        return {
          notes: { ...s.notes, [id]: { ...prev, ...patch, updatedAt: Date.now() } as Note },
        }
      }),

    moveNotes: (ids, dx, dy) =>
      set((s) => {
        if (!dx && !dy) return s
        const notes = { ...s.notes }
        for (const id of ids) {
          const n = notes[id]
          if (n) notes[id] = { ...n, x: n.x + dx, y: n.y + dy, updatedAt: Date.now() }
        }
        return { notes }
      }),

    resizeNote: (id, w, h) =>
      set((s) => {
        const n = s.notes[id]
        if (!n) return s
        return {
          notes: {
            ...s.notes,
            [id]: {
              ...n,
              w: Math.max(MIN_NOTE_W, Math.round(w)),
              h: Math.max(MIN_NOTE_H, Math.round(h)),
              updatedAt: Date.now(),
            },
          },
        }
      }),

    removeNotes: (ids) => {
      if (!ids.length) return
      get().commit()
      const { notes } = get()
      // 딸린 이미지 파일도 같이 지운다. 실패해도 노트 삭제는 진행한다.
      for (const id of ids) {
        const n = notes[id]
        if (n?.kind === 'image') void deleteImage(n.file)
      }
      set((s) => {
        const next = { ...s.notes }
        for (const id of ids) delete next[id]
        return {
          notes: next,
          noteIds: s.noteIds.filter((id) => !ids.includes(id)),
          selection: s.selection.filter((id) => !ids.includes(id)),
        }
      })
    },

    duplicateNotes: (ids) => {
      if (!ids.length) return
      get().commit()
      const { notes } = get()
      const clones: Note[] = []
      let z = topZ()
      for (const id of ids) {
        const src = notes[id]
        if (!src) continue
        clones.push({ ...src, id: newId(), x: src.x + 24, y: src.y + 24, z: ++z, createdAt: Date.now() })
      }
      set((s) => {
        const nextNotes = { ...s.notes }
        for (const c of clones) nextNotes[c.id] = c
        return {
          notes: nextNotes,
          noteIds: [...s.noteIds, ...clones.map((c) => c.id)],
          selection: clones.map((c) => c.id),
        }
      })
    },

    raise: (id) =>
      set((s) => {
        const n = s.notes[id]
        if (!n) return s
        const max = s.noteIds.reduce((m, i) => Math.max(m, s.notes[i]?.z ?? 0), 0)
        if (n.z === max) return s
        return { notes: { ...s.notes, [id]: { ...n, z: max + 1 } } }
      }),

    setViewport: (vp) =>
      set((s) => {
        const next = typeof vp === 'function' ? vp(s.viewport) : vp
        return { viewport: { ...next, zoom: clamp(next.zoom, MIN_ZOOM, MAX_ZOOM) } }
      }),

    zoomAt: (screenX, screenY, factor) =>
      set((s) => {
        const { x, y, zoom } = s.viewport
        const next = snapZoom(clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM))
        if (next === zoom) return s
        // 커서 밑의 월드 좌표가 제자리에 머물도록 오프셋을 다시 계산한다.
        const worldX = (screenX - x) / zoom
        const worldY = (screenY - y) / zoom
        return { viewport: { x: screenX - worldX * next, y: screenY - worldY * next, zoom: next } }
      }),

    select: (ids) => set({ selection: ids }),

    toggleSelect: (id) =>
      set((s) => ({
        selection: s.selection.includes(id) ? s.selection.filter((i) => i !== id) : [...s.selection, id],
      })),

    clearSelection: () => set({ selection: [] }),

    commit: () =>
      set((s) => ({
        past: [...s.past, snapshot()].slice(-UNDO_LIMIT),
        future: [],
      })),

    undo: () =>
      set((s) => {
        const prev = s.past.at(-1)
        if (!prev) return s
        return {
          ...prev,
          past: s.past.slice(0, -1),
          future: [...s.future, snapshot()],
          selection: s.selection.filter((id) => prev.notes[id]),
        }
      }),

    redo: () =>
      set((s) => {
        const next = s.future.at(-1)
        if (!next) return s
        return {
          ...next,
          past: [...s.past, snapshot()],
          future: s.future.slice(0, -1),
          selection: s.selection.filter((id) => next.notes[id]),
        }
      }),
  }
})

/** 화면 좌표 -> 월드 좌표 */
export const toWorld = (vp: Viewport, screenX: number, screenY: number) => ({
  x: (screenX - vp.x) / vp.zoom,
  y: (screenY - vp.y) / vp.zoom,
})

export { clamp, MIN_ZOOM, MAX_ZOOM }
