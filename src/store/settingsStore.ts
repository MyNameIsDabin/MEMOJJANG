/** 사용자 설정. 폰트/테마는 <html> 의 data-* 와 CSS 변수로 흘려보내
 *  컴포넌트마다 스타일 분기를 두지 않는다. */
import { create } from 'zustand'
import { storage } from '../platform/storage'
import { applyPalette, type Palette, type ThemeKey } from '../theme/palette'
import type { UserRule } from '../notes/detect'

export type { ThemeKey }

export type FontKey = 'galmuri11' | 'galmuri9' | 'galmuri14' | 'galmuri-mono' | 'system'

export interface FontOption {
  key: FontKey
  label: string
  /** 설정 패널에서 보여줄 한 줄 설명 */
  note: string
  stack: string
  /** 이 폰트가 설계된 픽셀 크기. 정수 배수에서만 또렷하게 나오므로 배율은 여기에 곱한다. */
  basePx: number
}

/** 기본값은 갈무리11 — 이 앱의 얼굴이다. 나머지는 취향껏 바꾸라고 열어둔다. */
export const FONT_OPTIONS: FontOption[] = [
  { key: 'galmuri11', label: '갈무리11', note: '기본값 · 고전 픽셀', stack: '"Galmuri11", monospace', basePx: 11 },
  { key: 'galmuri9', label: '갈무리9', note: '더 작고 촘촘하게', stack: '"Galmuri9", monospace', basePx: 10 },
  { key: 'galmuri14', label: '갈무리14', note: '큼직하고 시원하게', stack: '"Galmuri14", monospace', basePx: 14 },
  { key: 'galmuri-mono', label: '갈무리Mono11', note: '코드 붙여넣기 좋음', stack: '"GalmuriMono11", monospace', basePx: 11 },
  { key: 'system', label: '시스템 폰트', note: '픽셀 폰트가 눈에 피로할 때', stack: 'system-ui, "Malgun Gothic", sans-serif', basePx: 13 },
]

/** 픽셀 폰트를 뭉개지 않으려면 배율은 정수여야 한다. */
export const SCALE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '기본' },
  { value: 2, label: '크게' },
]

export interface Settings {
  font: FontKey
  /** 노트 글자 배율. 픽셀 폰트는 정수배에서 가장 또렷하다. */
  fontScale: number
  theme: ThemeKey
  showGrid: boolean
  snapToGrid: boolean
  alwaysOnTop: boolean
  /** 창을 닫아도 트레이에 남긴다. */
  minimizeToTray: boolean
  /** 복사할 때마다 자동으로 클립보드 노트를 만든다. 사생활 문제가 있어 기본은 꺼둔다. */
  clipboardWatch: boolean
  /** 어디서든 메모짱을 부르는 조합. null 이면 끈 것.
   *  Tauri 가 알아듣는 형식이다 — 예: "CommandOrControl+Shift+Space" */
  globalHotkey: string | null
  /** 테마마다 직접 고친 색. 손대지 않은 색은 여기 없고 기본값을 따른다. */
  themeColors: Partial<Record<ThemeKey, Partial<Palette>>>

  /** 붙여넣은 글을 보고 메모 보기 방식을 알아서 정할지. */
  memoAutoDetect: boolean
  /** 꺼 둔 내장 규칙의 id */
  memoDisabledBuiltins: string[]
  /** 직접 만든 규칙. 내장보다 먼저, 적어 둔 차례대로 본다. */
  memoUserRules: UserRule[]
}

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space'

/** 저장 형식은 크로스플랫폼이라 길다. 화면에는 짧게 보여 준다. */
export function formatAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => (part === 'CommandOrControl' ? 'Ctrl' : part))
    .join('+')
}

export const DEFAULT_SETTINGS: Settings = {
  font: 'galmuri11',
  fontScale: 1,
  theme: 'night',
  showGrid: true,
  snapToGrid: false,
  alwaysOnTop: false,
  minimizeToTray: true,
  clipboardWatch: false,
  globalHotkey: DEFAULT_HOTKEY,
  themeColors: {},
  memoAutoDetect: true,
  memoDisabledBuiltins: [],
  memoUserRules: [],
}

export const GRID_SIZE = 24

interface SettingsState extends Settings {
  hydrated: boolean
  hydrate: (loaded: Partial<Settings> | null) => void
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  reset: () => void

  /** 지금 테마의 색 하나를 고친다. */
  setThemeColor: (key: keyof Palette, value: string) => void
  /** 색 하나만 기본값으로 되돌린다. */
  resetThemeColor: (key: keyof Palette) => void
  /** 지금 테마에서 고친 색을 전부 되돌린다. */
  resetThemeColors: () => void
}

export const useSettings = create<SettingsState>()((set) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,
  hydrate: (loaded) => set({ ...DEFAULT_SETTINGS, ...(loaded ?? {}), hydrated: true }),
  set: (key, value) => set({ [key]: value } as Pick<Settings, typeof key>),
  reset: () => set({ ...DEFAULT_SETTINGS }),

  setThemeColor: (key, value) =>
    set((s) => ({
      themeColors: { ...s.themeColors, [s.theme]: { ...s.themeColors[s.theme], [key]: value } },
    })),

  resetThemeColor: (key) =>
    set((s) => {
      const forTheme = { ...s.themeColors[s.theme] }
      delete forTheme[key]
      return { themeColors: { ...s.themeColors, [s.theme]: forTheme } }
    }),

  resetThemeColors: () =>
    set((s) => {
      const next = { ...s.themeColors }
      delete next[s.theme]
      return { themeColors: next }
    }),
}))

/** 지금 테마에서 이 색이 기본값에서 벗어나 있는가. */
export function isThemeColorChanged(key: keyof Palette): boolean {
  const { theme, themeColors } = useSettings.getState()
  return themeColors[theme]?.[key] !== undefined
}

export function pickSettings(s: SettingsState): Settings {
  const { font, fontScale, theme, showGrid, snapToGrid } = s
  const { alwaysOnTop, minimizeToTray, clipboardWatch, globalHotkey, themeColors } = s
  const { memoAutoDetect, memoDisabledBuiltins, memoUserRules } = s
  return {
    font,
    fontScale,
    theme,
    showGrid,
    snapToGrid,
    alwaysOnTop,
    minimizeToTray,
    clipboardWatch,
    globalHotkey,
    themeColors,
    memoAutoDetect,
    memoDisabledBuiltins,
    memoUserRules,
  }
}

/** 설정을 문서 루트에 반영한다. 색은 팔레트에서 인라인 변수로 얹힌다. */
export function applySettings(s: Settings): void {
  const root = document.documentElement
  const font = FONT_OPTIONS.find((f) => f.key === s.font) ?? FONT_OPTIONS[0]
  root.style.setProperty('--ui-font', font.stack)
  root.style.setProperty('--ui-size', `${font.basePx * s.fontScale}px`)
  // 아이콘은 16 격자로 그려져 있어 정수배로만 키워야 도트가 어긋나지 않는다.
  root.style.setProperty('--ui-scale', String(s.fontScale))
  root.dataset.theme = s.theme
  // 시스템 폰트일 때만 안티에일리어싱을 되살린다.
  root.dataset.pixel = s.font === 'system' ? 'off' : 'on'
  applyPalette(s.theme, s.themeColors[s.theme])
}

export async function loadSettings(): Promise<void> {
  const loaded = await storage.loadSettings<Partial<Settings>>().catch(() => null)
  useSettings.getState().hydrate(loaded)
  applySettings(pickSettings(useSettings.getState()))
}
