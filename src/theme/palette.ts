import type { MessageKey } from '../i18n'
/** 테마 색.
 *
 *  CSS 가 아니라 여기 있는 이유: 사용자가 색을 직접 고칠 수 있어야 하는데,
 *  스타일시트에 박혀 있으면 읽어올 수도, 되돌릴 수도 없다.
 *  기본값은 여기가 유일한 출처이고, 화면에는 :root 인라인 변수로 얹는다.
 *
 *  값은 전부 `#rrggbb` 또는 `#rrggbbaa` 로 적는다. 투명도가 필요한 색까지 형식이 같아야
 *  편집기가 한 가지 방법으로 다룰 수 있다. */

export type ThemeKey = 'night' | 'day' | 'classic'

export interface Palette {
  canvas: string
  canvasDot: string
  face: string
  face2: string
  bevelLight: string
  bevelDark: string
  line: string
  shadow: string
  text: string
  textDim: string
  sel: string
  chromeBg: string
  chromeFg: string
  chromeLine: string
  chromeHover: string
  chromePress: string
  syntaxKey: string
  syntaxString: string
  syntaxNumber: string
  syntaxLiteral: string
}

/** 팔레트 열쇠 -> CSS 변수 이름 */
const CSS_VAR: Record<keyof Palette, string> = {
  canvas: '--canvas',
  canvasDot: '--canvas-dot',
  face: '--face',
  face2: '--face-2',
  bevelLight: '--bevel-light',
  bevelDark: '--bevel-dark',
  line: '--line',
  shadow: '--shadow',
  text: '--text',
  textDim: '--text-dim',
  sel: '--sel',
  chromeBg: '--chrome-bg',
  chromeFg: '--chrome-fg',
  chromeLine: '--chrome-line',
  chromeHover: '--chrome-hover',
  chromePress: '--chrome-press',
  syntaxKey: '--syntax-key',
  syntaxString: '--syntax-string',
  syntaxNumber: '--syntax-number',
  syntaxLiteral: '--syntax-literal',
}

export const THEMES: Record<ThemeKey, Palette> = {
  night: {
    canvas: '#16161f',
    canvasDot: '#2b2b3a',
    face: '#2b2b38',
    face2: '#1e1e28',
    bevelLight: '#454558',
    bevelDark: '#101018',
    line: '#3a3a4a',
    shadow: '#0000008c',
    text: '#e9e9f2',
    textDim: '#9a9ab0',
    sel: '#ffd75e',
    chromeBg: '#0e0e16',
    chromeFg: '#b6b6cb',
    chromeLine: '#24242f',
    chromeHover: '#ffffff17',
    chromePress: '#ffffff29',
    syntaxKey: '#7cc4f0',
    syntaxString: '#9fdca8',
    syntaxNumber: '#f0b26b',
    syntaxLiteral: '#c39ce8',
  },
  day: {
    // 밝기 차례가 셋으로 갈린다: 노트(가장 밝음) > 창 테두리 > 바닥(가장 어두움).
    // 바닥만 가라앉혀야 노트가 떠 보이고, 테두리는 밝게 남아야 창이 답답해지지 않는다.
    canvas: '#dbd7ce',
    canvasDot: '#bcb8ac',
    face: '#f2f0ea',
    face2: '#ffffff',
    bevelLight: '#ffffff',
    bevelDark: '#a8a49a',
    line: '#d4d0c6',
    shadow: '#00000038',
    text: '#22222c',
    textDim: '#6b6b78',
    sel: '#c2620f',
    chromeBg: '#ecebe5',
    chromeFg: '#43434d',
    chromeLine: '#cbc7bd',
    chromeHover: '#00000014',
    chromePress: '#00000026',
    syntaxKey: '#1a6ea8',
    syntaxString: '#216e3a',
    syntaxNumber: '#9a5a12',
    syntaxLiteral: '#6b3fa0',
  },
  classic: {
    canvas: '#008080',
    canvasDot: '#0d9494',
    face: '#d4d0c8',
    face2: '#ffffff',
    bevelLight: '#ffffff',
    bevelDark: '#808080',
    line: '#aeaaa2',
    shadow: '#00000059',
    text: '#000000',
    textDim: '#56544f',
    sel: '#000080',
    chromeBg: '#005959',
    chromeFg: '#cdeaea',
    chromeLine: '#007373',
    chromeHover: '#ffffff29',
    chromePress: '#ffffff47',
    syntaxKey: '#000080',
    syntaxString: '#006000',
    syntaxNumber: '#804000',
    syntaxLiteral: '#600060',
  },
}

/** 테마 이름은 말마다 다르므로 열쇠만 들고 있다가 화면에서 옮긴다. */
export const THEME_OPTIONS: { key: ThemeKey; labelKey: MessageKey; noteKey: MessageKey }[] = [
  { key: 'night', labelKey: 'theme.night', noteKey: 'theme.night.note' },
  { key: 'day', labelKey: 'theme.day', noteKey: 'theme.day.note' },
  { key: 'classic', labelKey: 'theme.classic', noteKey: 'theme.classic.note' },
]

export interface PaletteToken {
  key: keyof Palette
  labelKey: MessageKey
  /** 투명도까지 고를 수 있는 색인가 */
  alpha?: boolean
}

/** 편집기에 보여줄 차례. 눈에 띄는 것부터 위로 둔다. */
export const PALETTE_GROUPS: { titleKey: MessageKey; tokens: PaletteToken[] }[] = [
  {
    titleKey: 'palette.groupCanvas',
    tokens: [
      { key: 'canvas', labelKey: 'palette.canvas' },
      { key: 'canvasDot', labelKey: 'palette.canvasDot' },
    ],
  },
  {
    titleKey: 'palette.groupNote',
    tokens: [
      { key: 'face', labelKey: 'palette.face' },
      { key: 'face2', labelKey: 'palette.face2' },
      { key: 'bevelLight', labelKey: 'palette.bevelLight' },
      { key: 'bevelDark', labelKey: 'palette.bevelDark' },
      { key: 'line', labelKey: 'palette.line' },
      { key: 'shadow', labelKey: 'palette.shadow', alpha: true },
    ],
  },
  {
    titleKey: 'palette.groupText',
    tokens: [
      { key: 'text', labelKey: 'palette.text' },
      { key: 'textDim', labelKey: 'palette.textDim' },
      { key: 'sel', labelKey: 'palette.sel' },
    ],
  },
  {
    titleKey: 'palette.groupJson',
    tokens: [
      { key: 'syntaxKey', labelKey: 'palette.syntaxKey' },
      { key: 'syntaxString', labelKey: 'palette.syntaxString' },
      { key: 'syntaxNumber', labelKey: 'palette.syntaxNumber' },
      { key: 'syntaxLiteral', labelKey: 'palette.syntaxLiteral' },
    ],
  },
  {
    titleKey: 'palette.groupChrome',
    tokens: [
      { key: 'chromeBg', labelKey: 'palette.chromeBg' },
      { key: 'chromeFg', labelKey: 'palette.chromeFg' },
      { key: 'chromeLine', labelKey: 'palette.chromeLine' },
      { key: 'chromeHover', labelKey: 'palette.chromeHover', alpha: true },
      { key: 'chromePress', labelKey: 'palette.chromePress', alpha: true },
    ],
  },
]

/** 고친 색을 얹은 최종 팔레트. */
export function resolvePalette(theme: ThemeKey, overrides?: Partial<Palette>): Palette {
  return { ...THEMES[theme], ...(overrides ?? {}) }
}

/** 팔레트를 :root 의 인라인 변수로 얹는다. 스타일시트 값보다 우선한다. */
export function applyPalette(theme: ThemeKey, overrides?: Partial<Palette>): void {
  const palette = resolvePalette(theme, overrides)
  const root = document.documentElement
  for (const [key, cssVar] of Object.entries(CSS_VAR)) {
    root.style.setProperty(cssVar, palette[key as keyof Palette])
  }
}

/* ── 색 다루기 ─────────────────────────────────────────────────────────
   <input type="color"> 은 6자리 hex 만 받는다. 투명도는 따로 떼어 다룬다. */

export interface SplitColor {
  /** `#rrggbb` */
  hex: string
  /** 0~100 */
  alpha: number
}

export function splitColor(value: string): SplitColor {
  const hex = value.slice(0, 7).toLowerCase()
  const alphaHex = value.length >= 9 ? value.slice(7, 9) : 'ff'
  return { hex, alpha: Math.round((parseInt(alphaHex, 16) / 255) * 100) }
}

export function joinColor({ hex, alpha }: SplitColor, withAlpha: boolean): string {
  if (!withAlpha || alpha >= 100) return hex
  const clamped = Math.min(100, Math.max(0, alpha))
  return `${hex}${Math.round((clamped / 100) * 255)
    .toString(16)
    .padStart(2, '0')}`
}
