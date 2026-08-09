/** 설정 창. 고전 대화상자처럼 생겼고, 값은 바꾸는 즉시 반영·저장된다(확인 버튼 없음). */
import { useEffect, useState } from 'react'
import { SCALE_OPTIONS, fontOptions, useSettings, type Settings } from '../store/settingsStore'
import { THEME_OPTIONS } from '../theme/palette'
import { ThemeEditor } from './ThemeEditor'
import { MemoRules } from './MemoRules'
import { FontManager } from './FontManager'
import { UpdateSection } from './UpdateSection'
import { useCanvases } from '../store/canvasStore'
import { storage } from '../platform/storage'
import { isTauri } from '../platform/env'
import { HotkeyField } from './HotkeyField'
import { LOCALES, useT } from '../i18n'
import './settings.css'

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const { set } = s
  const activeCanvas = useCanvases((st) => st.canvases.find((c) => c.id === st.activeId) ?? null)
  const [editingColors, setEditingColors] = useState(false)
  const [editingRules, setEditingRules] = useState(false)
  const [addingFont, setAddingFont] = useState(false)
  const say = useT()
  const fonts = fontOptions(s.userFonts, say)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="settings__backdrop" onPointerDown={onClose}>
      <div
        className="settings bevel-out"
        role="dialog"
        aria-label={say('toolbar.settings')}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="settings__bar">
          <span className="settings__caption">{say('settings.title')}</span>
          <button type="button" className="note__ctl note__ctl--close" onClick={onClose} title={say('settings.close')}>
            ✕
          </button>
        </div>

        <div className="settings__body">
          <UpdateSection />

          <Section title={say('settings.language')}>
            <Segmented
              value={s.locale}
              options={LOCALES.map((l) => ({ value: l.value, label: l.label }))}
              onChange={(v) => set('locale', v)}
            />
            <p className="settings__note">{say('settings.languageNote')}</p>
          </Section>

          <Section title={say('settings.font')}>
            <p className="settings__note">
              {say('settings.fontNote')}
            </p>
            <div className="settings__fonts">
              {fonts.map((f) => (
                <label key={f.key} className={`fontcard${s.font === f.key ? ' fontcard--on' : ''}`}>
                  <input
                    type="radio"
                    name="font"
                    checked={s.font === f.key}
                    onChange={() => set('font', f.key)}
                  />
                  <span className="fontcard__sample" style={{ fontFamily: f.stack, fontSize: f.basePx }}>
                    {say('font.sample')}
                  </span>
                  <span className="fontcard__meta">
                    <b>{f.label}</b> · {f.note}
                  </span>
                </label>
              ))}
            </div>
            <div className="settings__actions">
              <button className="btn" aria-pressed={addingFont} onClick={() => setAddingFont((v) => !v)}>
                {say('settings.addFont')}
              </button>
            </div>
            {addingFont && <FontManager />}

            <Row label={say('settings.fontSize')}>
              <Segmented
                value={s.fontScale}
                options={SCALE_OPTIONS}
                onChange={(v) => set('fontScale', v)}
              />
            </Row>
            <p className="settings__note">
              {say('settings.fontSizeNote')}
            </p>
          </Section>

          <Section title={say('settings.theme')}>
            <div className="settings__row">
              <Segmented
                value={s.theme}
                options={THEME_OPTIONS.map((o) => ({ value: o.key, label: say(o.labelKey) }))}
                onChange={(v) => set('theme', v)}
              />
              <button
                className="btn"
                aria-pressed={editingColors}
                onClick={() => setEditingColors((v) => !v)}
                title={say('settings.editColorsHint')}
              >
                {say('settings.editColors')}
              </button>
            </div>
            <p className="settings__note">
              {say(THEME_OPTIONS.find((o) => o.key === s.theme)?.noteKey ?? 'theme.night.note')}
            </p>
            {editingColors && <ThemeEditor />}
          </Section>

          <Section title={say('settings.memoView')}>
            <p className="settings__note">
              {say('settings.memoViewNote')}
            </p>
            <Check
              label={say('settings.autoDetect')}
              checked={s.memoAutoDetect}
              onChange={(v) => set('memoAutoDetect', v)}
              note={say('settings.autoDetectNote')}
            />
            <div className="settings__actions">
              <button
                className="btn"
                aria-pressed={editingRules}
                disabled={!s.memoAutoDetect}
                onClick={() => setEditingRules((v) => !v)}
              >
                {say('settings.rules')}
              </button>
            </div>
            {editingRules && s.memoAutoDetect && <MemoRules />}
          </Section>

          <Section title={say('settings.canvas')}>
            <Check label={say('settings.showGrid')} checked={s.showGrid} onChange={(v) => set('showGrid', v)} />
            <Check
              label={say('settings.snap')}
              checked={s.snapToGrid}
              onChange={(v) => set('snapToGrid', v)}
              note={say('settings.snapNote')}
            />
          </Section>

          <Section title={say('settings.window')}>
            <Check
              label={say('settings.alwaysOnTop')}
              checked={s.alwaysOnTop}
              onChange={(v) => set('alwaysOnTop', v)}
            />
            <Check
              label={say('settings.tray')}
              checked={s.minimizeToTray}
              onChange={(v) => set('minimizeToTray', v)}
              note={say('settings.trayNote')}
            />
          </Section>

          <Section title={say('settings.hotkey')}>
            <p className="settings__note">
              {say('settings.hotkeyNote')}
            </p>
            <HotkeyField value={s.globalHotkey} onChange={(v) => set('globalHotkey', v)} />
            {!isTauri() && (
              <p className="settings__note">{say('settings.hotkeyBrowser')}</p>
            )}
          </Section>

          <Section title={say('settings.clipboard')}>
            <Check
              label={say('settings.clipboardWatch')}
              checked={s.clipboardWatch}
              onChange={(v) => set('clipboardWatch', v)}
              note={say('settings.clipboardNote')}
            />
          </Section>

          <Section title={say('settings.storage')}>
            <p className="settings__note">
              {isTauri() ? say('settings.storageNote') : say('settings.storageBrowser')}
            </p>
            {activeCanvas && <p className="settings__path">{activeCanvas.path}</p>}
            <div className="settings__actions">
              <button
                className="btn"
                onClick={() => void useCanvases.getState().revealActive()}
                disabled={!isTauri() || !activeCanvas}
              >
                {say('settings.revealCanvas')}
              </button>
              <button className="btn" onClick={() => void storage.revealDataFolder()} disabled={!isTauri()}>
                {say('settings.revealData')}
              </button>
              <button className="btn" onClick={() => useSettings.getState().reset()}>
                {say('settings.reset')}
              </button>
            </div>
          </Section>

          <Section title={say('settings.keys')}>
            <dl className="keys">
              {/* 키 이름은 자판에 적힌 그대로 두고, 설명만 말에 맞춰 바꾼다. */}
              {(
                [
                  ['Ctrl+1 / 2 / 3', 'keys.add'],
                  ['Ctrl+V', 'keys.paste'],
                  ['Ctrl+C', 'keys.copy'],
                  ['Ctrl+F', 'keys.find'],
                  ['Ctrl+Space', 'keys.list'],
                  ['Space', 'keys.focus'],
                  ['F2', 'keys.rename'],
                  ['Ctrl+Enter', 'keys.expand'],
                  ['Esc', 'keys.escape'],
                  [`Ctrl+${say('keys.wheelLabel')}`, 'keys.zoom'],
                  [say('keys.wheelLabel'), 'keys.wheel'],
                  [say('keys.wheelDrag'), 'keys.panWheel'],
                  [say('keys.emptyDrag'), 'keys.panEmpty'],
                  [say('keys.shiftDrag'), 'keys.marquee'],
                  ['Ctrl+D', 'keys.duplicate'],
                  ['Delete', 'keys.delete'],
                  ['Ctrl+Z / Ctrl+Y', 'keys.undo'],
                  ['Ctrl+0', 'keys.zoom100'],
                  ['Ctrl+Shift+0', 'keys.fit'],
                  ['Ctrl+Shift+G', 'keys.arrange'],
                ] as const
              ).map(([key, desc]) => (
                <div key={key} className="keys__row">
                  <dt>{key}</dt>
                  <dd>{say(desc)}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings__section">
      <h2 className="settings__title">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings__row">
      <span>{label}</span>
      {children}
    </div>
  )
}

function Check({
  label,
  checked,
  onChange,
  note,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  note?: string
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check__box" aria-hidden>
        {checked ? '✔' : ''}
      </span>
      <span className="check__text">
        {label}
        {note && <span className="check__note">{note}</span>}
      </span>
    </label>
  )
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className="btn"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export type { Settings }
