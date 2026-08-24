/** 열려 있는 캔버스들과 지금 보고 있는 캔버스.
 *
 *  캔버스 하나는 사용자가 고른 자리의 파일 하나다. 여기에는 목록과 경로만 두고,
 *  실제 노트는 전환할 때마다 boardStore 로 갈아 끼운다. */
import { create } from 'zustand'
import {
  CANVAS_EXT,
  CANVAS_VERSION,
  WORKSPACE_VERSION,
  newId,
  RECENT_LIMIT,
  type CanvasDoc,
  type CanvasRef,
  type RecentCanvas,
} from '../types'
import { useBoard } from './boardStore'
import { storage } from '../platform/storage'
import {
  emptyCanvas,
  readCanvas,
  releaseCanvasImages,
  sweepCanvasImages,
  writeCanvas,
} from '../platform/canvasFile'
import { baseName, dirName, files, joinPath, stemOf } from '../platform/files'
import { isTauri } from '../platform/env'
import { describeError, notify } from '../ui/toast'
import { t } from '../i18n'

interface CanvasState {
  canvases: CanvasRef[]
  activeId: string | null
  /** 최근에 열었던 것들. 지금 열려 있는 것도 들어 있다 — 걸러 내는 일은 보여 주는 쪽이 한다. */
  recent: RecentCanvas[]
  hydrated: boolean
  /** 파일을 읽고 쓰는 동안 탭을 잠근다. 연타로 두 캔버스가 섞이는 것을 막는다. */
  busy: boolean

  activeCanvas: () => CanvasRef | null
  activePath: () => string | null

  hydrate: () => Promise<void>
  createCanvas: () => Promise<void>
  openCanvas: () => Promise<void>
  /** 최근 기록에서 고른 것을 연다. 이미 열려 있으면 그 탭으로 간다. */
  openRecent: (path: string) => Promise<void>
  forgetRecent: (path: string) => void
  clearRecent: () => void
  switchTo: (id: string) => Promise<void>
  closeCanvas: (id: string) => Promise<void>
  renameCanvas: (id: string, name: string) => void
  revealActive: () => Promise<void>
}

/** 지금 캔버스를 파일에 쓴다. 자동 저장과 전환 직전 모두 이 함수를 지난다. */
export async function saveActiveCanvas(): Promise<void> {
  const state = useCanvases.getState()
  const ref = state.activeCanvas()
  if (!ref) return

  const board = useBoard.getState()
  if (!board.hydrated) return

  const doc: CanvasDoc = { version: CANVAS_VERSION, name: ref.name, ...board.contents() }
  await writeCanvas(ref.path, doc)
}

async function persistWorkspace(): Promise<void> {
  const { canvases, activeId, recent } = useCanvases.getState()
  await storage
    .saveWorkspace({ version: WORKSPACE_VERSION, canvases, activeId, recent })
    .catch((err) => console.error('[canvas] 작업공간 저장 실패', err))
}

/** 캔버스 개념이 없던 판에서 쓰던 단일 보드를 캔버스 하나로 데려온다.
 *  그냥 두면 사용자 눈에는 메모가 전부 사라진 것처럼 보인다. */
async function migrateLegacyBoard(): Promise<CanvasRef | null> {
  if (!isTauri()) return null

  try {
    const { appDataDir } = await import('@tauri-apps/api/path')
    const dir = await appDataDir()
    const legacy = joinPath(dir, 'board.json')
    if (!(await files.exists(legacy))) return null

    // 예전에는 그림이 앱 데이터의 images 폴더에 모여 있었다. 새 규칙에 맞는 자리로 옮긴다.
    const oldImages = joinPath(dir, 'images')
    const newImages = joinPath(dir, 'board.assets')
    if ((await files.exists(oldImages)) && !(await files.exists(newImages))) {
      await files.rename(oldImages, newImages).catch(() => {})
    }

    const ref: CanvasRef = { id: newId(), path: legacy, name: t('canvas.myBoard') }
    notify(t('canvas.moved'))
    return ref
  } catch (err) {
    console.error('[canvas] 예전 보드 이전 실패', err)
    return null
  }
}

/** 새 캔버스를 만들 때 대화상자에 미리 채워 넣을 경로. */
async function suggestedPath(): Promise<string> {
  const fallback = `${t('canvas.newBoard')}.${CANVAS_EXT}`
  if (!isTauri()) return fallback
  try {
    const { documentDir } = await import('@tauri-apps/api/path')
    return joinPath(joinPath(await documentDir(), t('canvas.folderName')), fallback)
  } catch {
    return fallback
  }
}

const filters = () => [{ name: t('canvas.filter'), extensions: ['json'] }]

async function askSavePath(): Promise<string | null> {
  if (!isTauri()) {
    const typed = window.prompt(t('canvas.promptSave'), `${t('canvas.newBoard')}.${CANVAS_EXT}`)
    return typed?.trim() || null
  }
  const { save } = await import('@tauri-apps/plugin-dialog')
  return save({ title: t('canvas.saveTitle'), defaultPath: await suggestedPath(), filters: filters() })
}

async function askOpenPath(): Promise<string | null> {
  if (!isTauri()) {
    const typed = window.prompt(t('canvas.promptOpen'))
    return typed?.trim() || null
  }
  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({ title: t('canvas.openTitle'), multiple: false, directory: false, filters: filters() })
  return typeof picked === 'string' ? picked : null
}

/** 최근 목록 맨 앞에 하나를 올린다. 같은 파일은 한 자리만 차지한다. */
function remember(list: RecentCanvas[], entry: RecentCanvas): RecentCanvas[] {
  return [entry, ...list.filter((r) => r.path !== entry.path)].slice(0, RECENT_LIMIT)
}

/** 사용자가 확장자를 지운 채로 저장하는 일이 흔하다. 조용히 붙여 준다. */
function withExtension(path: string): string {
  return /\.json$/i.test(path) ? path : `${path}.${CANVAS_EXT}`
}

export const useCanvases = create<CanvasState>()((set, get) => {
  /** 파일을 읽어 화면에 올린다. 실패하면 사용자에게 알리고 false. */
  const loadInto = async (ref: CanvasRef): Promise<boolean> => {
    useBoard.getState().unhydrate()
    try {
      const doc = await readCanvas(ref.path)
      if (!doc) {
        notify(t('canvas.notFound', { path: ref.path }), 'error')
        // 내용은 비워 두되 탭은 남긴다. 사용자가 파일을 되돌려 놓을 수도 있다.
        useBoard.getState().hydrate(null)
        return false
      }
      useBoard.getState().hydrate(doc)
      // 파일 안의 이름이 정본이다. 탭 이름과 어긋나면 파일 쪽을 따른다.
      const name = doc.name || ref.name
      if (doc.name && doc.name !== ref.name) {
        set((s) => ({ canvases: s.canvases.map((c) => (c.id === ref.id ? { ...c, name: doc.name } : c)) }))
      }
      // 화면에 올라온 것만 기록한다. 열려다 실패한 것을 최근 목록에 남기면 죽은 줄만 늘어난다.
      set((s) => ({ recent: remember(s.recent, { path: ref.path, name, at: Date.now() }) }))

      /* 아무도 가리키지 않는 그림을 이제야 치운다. 노트를 지우는 그 자리에서 함께 지우면
         Ctrl+Z 로 노트만 돌아오고 그림은 못 돌아온다. 방금 hydrate 가 되돌리기 기록을
         비웠으므로, 지금 남은 고아 파일은 정말로 아무도 찾지 않는 것이다.
         화면을 막을 이유는 없어 기다리지 않는다. */
      void sweepCanvasImages(ref.path, doc).catch((err) =>
        console.error('[canvas] 남은 그림 정리 실패', err),
      )
      return true
    } catch (err) {
      notify(t('canvas.openFailed', { reason: describeError(err) }), 'error')
      useBoard.getState().hydrate(null)
      return false
    }
  }

  /** 경로 하나를 탭으로 올린다. 폴더에서 고른 것도, 최근 기록에서 고른 것도 여기로 모인다. */
  const openPath = async (path: string): Promise<void> => {
    const already = get().canvases.find((c) => c.path === path)
    if (already) {
      await get().switchTo(already.id)
      return
    }

    set({ busy: true })
    try {
      await saveActiveCanvas()
      const ref: CanvasRef = { id: newId(), path, name: stemOf(path) || baseName(path) }
      set((s) => ({ canvases: [...s.canvases, ref], activeId: ref.id }))
      await loadInto(ref)
      await persistWorkspace()
    } catch (err) {
      notify(t('canvas.openFailed', { reason: describeError(err) }), 'error')
    } finally {
      set({ busy: false })
    }
  }

  return {
    canvases: [],
    activeId: null,
    recent: [],
    hydrated: false,
    busy: false,

    activeCanvas: () => {
      const { canvases, activeId } = get()
      return canvases.find((c) => c.id === activeId) ?? null
    },

    activePath: () => get().activeCanvas()?.path ?? null,

    hydrate: async () => {
      const workspace = await storage.loadWorkspace().catch(() => null)

      if (!workspace) {
        const migrated = await migrateLegacyBoard()
        if (migrated) {
          set({ canvases: [migrated], activeId: migrated.id, hydrated: true })
          await loadInto(migrated)
          await persistWorkspace()
          return
        }
      }

      const canvases = workspace?.canvases ?? []
      set({ recent: workspace?.recent ?? [] })
      const activeId = canvases.some((c) => c.id === workspace?.activeId)
        ? (workspace?.activeId ?? null)
        : (canvases[0]?.id ?? null)

      set({ canvases, activeId, hydrated: true })

      const ref = canvases.find((c) => c.id === activeId)
      if (ref) await loadInto(ref)
      else useBoard.getState().hydrate(null)

      // 켤 때 올라온 것도 최근 목록에 넣어 둔다 — 이 기능이 생기기 전부터 열려 있던 캔버스는
      // 여기서 한 번 적어 주지 않으면 탭을 닫는 순간 되찾을 길이 사라진다.
      await persistWorkspace()
    },

    createCanvas: async () => {
      if (get().busy) return
      const picked = await askSavePath()
      if (!picked) return

      const path = withExtension(picked)
      set({ busy: true })
      try {
        if (get().canvases.some((c) => c.path === path)) {
          notify(t('canvas.already'))
          return
        }
        const name = stemOf(path) || t('canvas.newBoard')
        await writeCanvas(path, emptyCanvas(name))

        await saveActiveCanvas()
        const ref: CanvasRef = { id: newId(), path, name }
        set((s) => ({ canvases: [...s.canvases, ref], activeId: ref.id }))
        await loadInto(ref)
        await persistWorkspace()
      } catch (err) {
        notify(t('canvas.createFailed', { reason: describeError(err) }), 'error')
      } finally {
        set({ busy: false })
      }
    },

    openCanvas: async () => {
      if (get().busy) return
      const path = await askOpenPath()
      if (path) await openPath(path)
    },

    openRecent: async (path) => {
      if (get().busy) return
      // 그새 옮겨졌거나 지워진 파일일 수 있다. 빈 탭을 만들어 두느니 기록에서 빼는 편이 낫다.
      // 확인 자체가 실패하면 있다고 보고 열어 본다 — 판단을 못 했다고 지울 이유는 없다.
      if (isTauri() && !(await files.exists(path).catch(() => true))) {
        notify(t('canvas.notFound', { path }), 'error')
        get().forgetRecent(path)
        return
      }
      await openPath(path)
    },

    forgetRecent: (path) => {
      set((s) => ({ recent: s.recent.filter((r) => r.path !== path) }))
      void persistWorkspace()
    },

    clearRecent: () => {
      set({ recent: [] })
      void persistWorkspace()
    },

    switchTo: async (id) => {
      const { activeId, canvases, busy } = get()
      if (busy || id === activeId) return
      const ref = canvases.find((c) => c.id === id)
      if (!ref) return

      set({ busy: true })
      try {
        // 떠나기 전에 지금 것을 확실히 저장한다. 미뤄둔 자동 저장이 있을 수 있다.
        await saveActiveCanvas()
        set({ activeId: id })
        await loadInto(ref)
        await persistWorkspace()
      } finally {
        set({ busy: false })
      }
    },

    closeCanvas: async (id) => {
      const { canvases, activeId, busy } = get()
      if (busy) return
      const ref = canvases.find((c) => c.id === id)
      if (!ref) return

      set({ busy: true })
      try {
        if (id === activeId) await saveActiveCanvas()

        const remaining = canvases.filter((c) => c.id !== id)
        // 닫은 것이 보고 있던 탭이면 바로 옆으로 옮겨 간다.
        const at = canvases.findIndex((c) => c.id === id)
        const nextActive =
          id === activeId ? (remaining[Math.min(at, remaining.length - 1)]?.id ?? null) : activeId

        releaseCanvasImages(ref.path)
        set({ canvases: remaining, activeId: nextActive })

        const nextRef = remaining.find((c) => c.id === nextActive)
        if (nextRef) await loadInto(nextRef)
        else useBoard.getState().hydrate(null)

        await persistWorkspace()
      } finally {
        set({ busy: false })
      }
    },

    renameCanvas: (id, name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      set((s) => ({ canvases: s.canvases.map((c) => (c.id === id ? { ...c, name: trimmed } : c)) }))
      // 이름은 파일 안에도 들어간다. 파일만 따로 옮겨도 이름이 따라가도록.
      void saveActiveCanvas().catch(() => {})
      void persistWorkspace()
    },

    revealActive: async () => {
      const ref = get().activeCanvas()
      if (!ref) return
      await files.reveal(ref.path).catch((err) => notify(describeError(err), 'error'))
    },
  }
})

/** 설정 패널 등에서 "이 캔버스가 어디 있는지" 를 보여줄 때. */
export function activeCanvasFolder(): string | null {
  const ref = useCanvases.getState().activeCanvas()
  return ref ? dirName(ref.path) : null
}
