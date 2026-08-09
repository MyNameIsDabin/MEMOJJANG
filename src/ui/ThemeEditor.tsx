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
import { useT } from '../i18n'
import './themeEditor.css'

export function ThemeEditor() {
  const say = useT()
  const theme = useSettings((s) => s.theme)
  const overrides = useSettings((s) => s.themeColors[s.theme])
  const palette = resolvePalette(theme, overrides)
  const changedCount = Object.keys(overrides ?? {}).length

  return (
    <div className="themeedit">
      <p className="settings__note">{say('theme.editNote')}</p>

      {PALETTE_GROUPS.map((group) => (
        <div key={group.titleKey} className="themeedit__group">
          <h3 className="themeedit__title">{say(group.titleKey)}</h3>
          {group.tokens.map((token) => (
            <ColorRow key={token.key} token={token} value={palette[token.key]} theme={theme} />
          ))}
        </div>
      ))}

      <div className="themeedit__foot">
        <span>{changedCount ? say('theme.changed', { n: changedCount }) : say('theme.untouched')}</span>
        <button
          type="button"
          className="btn"
          disabled={!changedCount}
          onClick={() => useSettings.getState().resetThemeColors()}
        >
          {say('theme.resetAll')}
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
  const say = useT()
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
      <span className="colorrow__label">{say(token.labelKey)}</span>

      {token.alpha && (
        <span className="colorrow__alpha">
          <input
            type="range"
            min={0}
            max={100}
            value={alpha}
            aria-label={say('theme.alphaOf', { name: say(token.labelKey) })}
            onChange={(e) => update({ alpha: Number(e.target.value) })}
          />
          <span className="colorrow__pct">{alpha}%</span>
        </span>
      )}

      <code className="colorrow__hex">{value}</code>

      <button
        type="button"
        className="colorrow__reset"
        title={say('theme.resetOne')}
        disabled={isDefault}
        onClick={() => useSettings.getState().resetThemeColor(token.key)}
      >
        <Icon name="undo" />
      </button>
    </label>
  )
}
