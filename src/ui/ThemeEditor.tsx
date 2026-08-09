/** 지금 테마의 색을 하나씩 고치는 편집기.
 *  고치는 즉시 화면 전체에 반영되므로 미리보기가 따로 필요 없다. */
import { useSettings } from '../store/settingsStore'
import {
  PALETTE_GROUPS,
  THEMES,
  joinColor,
  resolvePalette,
  splitColor,
  type PaletteToken,
} from '../theme/palette'
import { Icon } from './Icon'
import './themeEditor.css'

export function ThemeEditor() {
  const theme = useSettings((s) => s.theme)
  const overrides = useSettings((s) => s.themeColors[s.theme])
  const palette = resolvePalette(theme, overrides)
  const changedCount = Object.keys(overrides ?? {}).length

  return (
    <div className="themeedit">
      <p className="settings__note">
        고친 색은 이 테마에만 남습니다. 다른 테마로 옮기면 그 테마의 색이 그대로 나옵니다.
      </p>

      {PALETTE_GROUPS.map((group) => (
        <div key={group.title} className="themeedit__group">
          <h3 className="themeedit__title">{group.title}</h3>
          {group.tokens.map((token) => (
            <ColorRow key={token.key} token={token} value={palette[token.key]} theme={theme} />
          ))}
        </div>
      ))}

      <div className="themeedit__foot">
        <span>{changedCount ? `${changedCount}개 고침` : '기본값 그대로'}</span>
        <button
          type="button"
          className="btn"
          disabled={!changedCount}
          onClick={() => useSettings.getState().resetThemeColors()}
        >
          이 테마 전체 되돌리기
        </button>
      </div>
    </div>
  )
}

function ColorRow({
  token,
  value,
  theme,
}: {
  token: PaletteToken
  value: string
  theme: keyof typeof THEMES
}) {
  const { hex, alpha } = splitColor(value)
  const isDefault = value === THEMES[theme][token.key]

  const update = (next: { hex?: string; alpha?: number }) => {
    useSettings
      .getState()
      .setThemeColor(
        token.key,
        joinColor({ hex: next.hex ?? hex, alpha: next.alpha ?? alpha }, Boolean(token.alpha)),
      )
  }

  return (
    <label className="colorrow">
      <input
        className="colorrow__swatch"
        type="color"
        value={hex}
        onChange={(e) => update({ hex: e.target.value })}
      />
      <span className="colorrow__label">{token.label}</span>

      {token.alpha && (
        <span className="colorrow__alpha">
          <input
            type="range"
            min={0}
            max={100}
            value={alpha}
            aria-label={`${token.label} 투명도`}
            onChange={(e) => update({ alpha: Number(e.target.value) })}
          />
          <span className="colorrow__pct">{alpha}%</span>
        </span>
      )}

      <code className="colorrow__hex">{value}</code>

      <button
        type="button"
        className="colorrow__reset"
        title="이 색만 되돌리기"
        disabled={isDefault}
        onClick={() => useSettings.getState().resetThemeColor(token.key)}
      >
        <Icon name="undo" />
      </button>
    </label>
  )
}
