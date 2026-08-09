/** 사용자 설정. 폰트/테마는 <html> 의 data-* 와 CSS 변수로 흘려보내
 *  컴포넌트마다 스타일 분기를 두지 않는다. */
import { create } from 'zustand'
import { storage } from '../platform/storage'
import { applyPalette, type Palette, type ThemeKey } from '../theme/palette'
import type { UserRule } from '../notes/detect'
import type { StickerAsset } from '../types'
import type { Locale, MessageKey } from '../i18n'

export type { ThemeKey }

/** 내장 글꼴은 정해진 이름을, 직접 더한 글꼴은 'user:...' 를 쓴다. */
export type FontKey = string

export interface FontOption {
  key: FontKey
  label: string
  /** 설정 패널에서 보여줄 한 줄 설명 — 내장 글꼴은 noteKey 로 대신한다 */
  note?: string
  /** 내장 글꼴의 이름·설명은 말마다 다르다. 열쇠로 들고 있다가 화면에서 옮긴다. */
  labelKey?: MessageKey
  noteKey?: MessageKey
  stack: string
  /** 이 폰트가 설계된 픽셀 크기. 정수 배수에서만 또렷하게 나오므로 배율은 여기에 곱한다. */
  basePx: number
  /** 도트 글꼴이면 안티에일리어싱을 끈다. */
  pixel: boolean
}

/** 사용자가 직접 더한 글꼴.
 *  `file` 이 있으면 앱 데이터 폴더의 fonts/ 에 복사해 둔 파일이고,
 *  없으면 이 컴퓨터에 이미 깔려 있는 글꼴을 이름으로 부르는 것이다. */
export interface UserFont {
  key: string
  label: string
  /** CSS font-family 이름. 파일에서 불러온 것은 우리가 지어 준 이름이다. */
  family: string
  file?: string
  basePx: number
  pixel: boolean
}

/** 기본값은 갈무리11 — 이 앱의 얼굴이다. 나머지는 취향껏 바꾸라고 열어둔다. */
export const BUILTIN_FONTS: FontOption[] = [
  { key: 'galmuri11', label: '갈무리11', noteKey: 'font.note.galmuri11', stack: '"Galmuri11", monospace', basePx: 11, pixel: true },
  { key: 'galmuri9', label: '갈무리9', noteKey: 'font.note.galmuri9', stack: '"Galmuri9", monospace', basePx: 10, pixel: true },
  { key: 'galmuri14', label: '갈무리14', noteKey: 'font.note.galmuri14', stack: '"Galmuri14", monospace', basePx: 14, pixel: true },
  { key: 'galmuri-mono', label: '갈무리Mono11', noteKey: 'font.note.galmuriMono', stack: '"GalmuriMono11", monospace', basePx: 11, pixel: true },
  { key: 'system', label: '', labelKey: 'font.systemLabel', noteKey: 'font.note.system', stack: 'system-ui, "Malgun Gothic", sans-serif', basePx: 13, pixel: false },
]

/** 직접 더한 글꼴까지 합친 목록. 설정 화면과 applySettings 가 같은 것을 봐야 한다.
 *  글로 보여 줄 이름·설명은 말에 따라 다르므로 옮기는 함수를 받아서 여기서 푼다. */
export function fontOptions(userFonts: UserFont[], say: (key: MessageKey) => string): FontOption[] {
  return [
    ...BUILTIN_FONTS.map((f) => ({
      ...f,
      label: f.labelKey ? say(f.labelKey) : f.label,
      note: f.noteKey ? say(f.noteKey) : f.note,
    })),
    ...userFonts.map((f) => ({
      key: f.key,
      label: f.label,
      note: f.file ? say('font.fromFile') : say('font.installed'),
      // 이름에 공백이 있어도 되도록 따옴표로 감싼다. 뒤의 monospace 는 못 찾았을 때의 대비책.
      stack: `"${f.family}", monospace`,
      basePx: f.basePx,
      pixel: f.pixel,
    })),
  ]
}

/** 픽셀 글꼴은 정수 배에서만 도트가 딱 떨어진다.
 *  그래도 사이 값을 막지는 않는다 — 눈이 편한 쪽이 사람마다 다르고,
 *  조금 뭉개지더라도 크게 보고 싶은 때가 있다. 대신 설정 화면에서 그 사실을 알려 준다. */
export const SCALE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '100%' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' },
  { value: 1.75, label: '175%' },
  { value: 2, label: '200%' },
  { value: 2.5, label: '250%' },
  { value: 3, label: '300%' },
]

export interface Settings {
  /** 화면 글자를 어느 말로 보여 줄지. 적어 둔 메모는 건드리지 않는다. */
  locale: Locale
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

  /** 직접 더한 글꼴 */
  userFonts: UserFont[]

  /** 꾸미기 스티커 보관함. 캔버스가 아니라 앱에 딸린다 — 여러 캔버스에서 함께 쓴다. */
  stickerAssets: StickerAsset[]
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
  locale: 'ko',
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
  userFonts: [],
  stickerAssets: [],
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
  const { locale, font, fontScale, theme, showGrid, snapToGrid } = s
  const { alwaysOnTop, minimizeToTray, clipboardWatch, globalHotkey, themeColors } = s
  const { memoAutoDetect, memoDisabledBuiltins, memoUserRules, userFonts, stickerAssets } = s
  return {
    locale,
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
    userFonts,
    stickerAssets,
  }
}

/** 설정을 문서 루트에 반영한다. 색은 팔레트에서 인라인 변수로 얹힌다. */
export function applySettings(s: Settings): void {
  const root = document.documentElement
  // 여기서는 글자 모양만 쓰므로 이름을 옮길 필요가 없다.
  const font =
    BUILTIN_FONTS.find((f) => f.key === s.font) ??
    s.userFonts.find((f) => f.key === s.font) ??
    BUILTIN_FONTS[0]
  root.style.setProperty('--ui-font', 'stack' in font ? font.stack : `\"${font.family}\", monospace`)
  // 소수점 크기는 글자를 흐리게 만든다. 배율이 정수가 아니어도 최종 크기는 정수로 떨군다.
  root.style.setProperty('--ui-size', `${Math.round(font.basePx * s.fontScale)}px`)
  root.style.setProperty('--ui-scale', String(s.fontScale))
  root.dataset.theme = s.theme
  // 브라우저가 글자를 다룰 때(줄바꿈·글꼴 고르기) 쓰는 표시다.
  root.lang = s.locale
  // 도트 글꼴일 때만 안티에일리어싱을 끈다.
  root.dataset.pixel = font.pixel ? 'on' : 'off'
  applyPalette(s.theme, s.themeColors[s.theme])
}

export async function loadSettings(): Promise<void> {
  const loaded = await storage.loadSettings<Partial<Settings>>().catch(() => null)
  useSettings.getState().hydrate(loaded)

  // 불러온 글꼴 파일을 브라우저에 등록한 뒤에 반영해야 첫 화면부터 제 모습으로 나온다.
  const { registerUserFonts } = await import('../platform/fonts')
  await registerUserFonts(useSettings.getState().userFonts)

  applySettings(pickSettings(useSettings.getState()))
}
