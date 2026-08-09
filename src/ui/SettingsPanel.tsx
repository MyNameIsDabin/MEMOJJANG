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
import './settings.css'

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const { set } = s
  const activeCanvas = useCanvases((st) => st.canvases.find((c) => c.id === st.activeId) ?? null)
  const [editingColors, setEditingColors] = useState(false)
  const [editingRules, setEditingRules] = useState(false)
  const [addingFont, setAddingFont] = useState(false)
  const fonts = fontOptions(s.userFonts)

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
        aria-label="설정"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="settings__bar">
          <span className="settings__caption">메모짱 설정</span>
          <button type="button" className="note__ctl note__ctl--close" onClick={onClose} title="닫기">
            ✕
          </button>
        </div>

        <div className="settings__body">
          <UpdateSection />

          <Section title="글꼴">
            <p className="settings__note">
              기본은 고전 픽셀 글꼴 <b>갈무리11</b>입니다. 픽셀 글꼴은 정수 배율에서 가장 또렷합니다.
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
                    메모짱 ABC 0123 할일
                  </span>
                  <span className="fontcard__meta">
                    <b>{f.label}</b> · {f.note}
                  </span>
                </label>
              ))}
            </div>
            <div className="settings__actions">
              <button className="btn" aria-pressed={addingFont} onClick={() => setAddingFont((v) => !v)}>
                ＋ 글꼴 더하기
              </button>
            </div>
            {addingFont && <FontManager />}

            <Row label="글자 크기">
              <Segmented
                value={s.fontScale}
                options={SCALE_OPTIONS}
                onChange={(v) => set('fontScale', v)}
              />
            </Row>
            <p className="settings__note">
              도트 글꼴은 100% · 200% · 300% 처럼 정수 배에서 가장 또렷합니다. 사이 값은 조금 뭉개집니다.
            </p>
          </Section>

          <Section title="테마">
            <div className="settings__row">
              <Segmented
                value={s.theme}
                options={THEME_OPTIONS.map((t) => ({ value: t.key, label: t.label }))}
                onChange={(v) => set('theme', v)}
              />
              <button
                className="btn"
                aria-pressed={editingColors}
                onClick={() => setEditingColors((v) => !v)}
                title="이 테마의 색을 하나씩 고칩니다"
              >
                🎨 색 고치기
              </button>
            </div>
            <p className="settings__note">{THEME_OPTIONS.find((t) => t.key === s.theme)?.note}</p>
            {editingColors && <ThemeEditor />}
          </Section>

          <Section title="텍스트 메모 보기">
            <p className="settings__note">
              메모는 기본으로 '그대로' 보여 줍니다. 노트 아래쪽에서 언제든 바꿀 수 있습니다.
            </p>
            <Check
              label="붙여넣은 글을 보고 알아서 정하기"
              checked={s.memoAutoDetect}
              onChange={(v) => set('memoAutoDetect', v)}
              note="빈 메모에 처음 붙여넣거나, 전체를 잡아 놓고 갈아치울 때만 한 번 살펴봅니다. 글자를 칠 때는 건드리지 않습니다."
            />
            <div className="settings__actions">
              <button
                className="btn"
                aria-pressed={editingRules}
                disabled={!s.memoAutoDetect}
                onClick={() => setEditingRules((v) => !v)}
              >
                ⚖ 판단 규칙 관리
              </button>
            </div>
            {editingRules && s.memoAutoDetect && <MemoRules />}
          </Section>

          <Section title="캔버스">
            <Check label="격자 점 보이기" checked={s.showGrid} onChange={(v) => set('showGrid', v)} />
            <Check
              label="옮길 때 격자에 맞추기"
              checked={s.snapToGrid}
              onChange={(v) => set('snapToGrid', v)}
              note="노트를 놓는 순간 24px 격자에 딱 붙습니다."
            />
          </Section>

          <Section title="창">
            <Check
              label="항상 다른 창 위에 띄우기"
              checked={s.alwaysOnTop}
              onChange={(v) => set('alwaysOnTop', v)}
            />
            <Check
              label="닫아도 트레이에 남기기"
              checked={s.minimizeToTray}
              onChange={(v) => set('minimizeToTray', v)}
              note="끄면 닫기 버튼이 곧 종료입니다. 트레이 아이콘을 눌러 다시 부를 수 있습니다."
            />
          </Section>

          <Section title="전역 단축키">
            <p className="settings__note">
              어느 프로그램을 쓰고 있든 메모짱을 불러내고, 한 번 더 누르면 다시 숨깁니다.
              칸을 누른 뒤 원하는 조합을 그대로 눌러 보세요.
            </p>
            <HotkeyField value={s.globalHotkey} onChange={(v) => set('globalHotkey', v)} />
            {!isTauri() && (
              <p className="settings__note">브라우저에서는 동작하지 않습니다. 실제 앱에서만 걸립니다.</p>
            )}
          </Section>

          <Section title="클립보드">
            <Check
              label="복사할 때마다 자동으로 모으기"
              checked={s.clipboardWatch}
              onChange={(v) => set('clipboardWatch', v)}
              note="켜면 다른 프로그램에서 복사한 내용까지 보드에 쌓입니다. 비밀번호 같은 게 섞일 수 있어 기본은 꺼져 있습니다."
            />
          </Section>

          <Section title="저장">
            <p className="settings__note">
              {isTauri() ? (
                <>
                  캔버스는 각자 고른 자리에 파일로 저장됩니다. 붙여넣은 그림은 그 파일 옆의{' '}
                  <b>.assets</b> 폴더에 따로 담기니, 캔버스 파일을 옮길 때는 이 폴더도 함께 옮겨 주세요.
                </>
              ) : (
                '브라우저에서는 localStorage 에 흉내만 냅니다. 실제 앱에서만 파일로 저장됩니다.'
              )}
            </p>
            {activeCanvas && <p className="settings__path">{activeCanvas.path}</p>}
            <div className="settings__actions">
              <button
                className="btn"
                onClick={() => void useCanvases.getState().revealActive()}
                disabled={!isTauri() || !activeCanvas}
              >
                캔버스 파일 위치 열기
              </button>
              <button className="btn" onClick={() => void storage.revealDataFolder()} disabled={!isTauri()}>
                앱 설정 폴더 열기
              </button>
              <button className="btn" onClick={() => useSettings.getState().reset()}>
                설정 초기화
              </button>
            </div>
          </Section>

          <Section title="단축키">
            <dl className="keys">
              {(
                [
                  ['Ctrl+1 / 2 / 3', '할 일 · 메모 · 바로가기 추가'],
                  ['Ctrl+V', '커서 자리에 붙여넣기 (그림은 그림 노트로)'],
                  ['Ctrl+F', '보드 안에서 찾기 (다시 누르면 닫힘)'],
                  ['Ctrl+Space', '노트 목록 펼치기 — ↑↓ · Tab 으로 고르고 Enter'],
                  ['F2', '고른 노트의 이름 바꾸기'],
                  ['Ctrl+Enter', '고른 노트를 화면 가득 펼치기 (다시 누르면 접힘)'],
                  ['Esc', '화면 가득 펼친 노트 접기 · 꾸미기 나가기 · 열린 패널 닫기'],
                  ['Ctrl+휠', '커서 기준 확대·축소'],
                  ['휠', '스크롤 되는 노트 위에서만 — 그 안을 굴립니다'],
                  ['휠 클릭 드래그', '어디서든 캔버스 이동'],
                  ['빈 곳 드래그', '캔버스 이동'],
                  ['Shift+드래그', '여러 개 선택'],
                  ['Ctrl+D', '선택한 노트 복제'],
                  ['Delete', '선택한 노트 삭제'],
                  ['Ctrl+Z / Ctrl+Y', '되돌리기 · 다시 실행'],
                  ['Ctrl+0', '확대 100%'],
                  ['Ctrl+Shift+0', '전체 보기로 맞추기'],
                  ['Ctrl+Shift+G', '격자에 맞춰 정리'],
                ] as const
              ).map(([key, desc]) => (
                <div key={key} className="keys__row">
                  <dt>{key}</dt>
                  <dd>{desc}</dd>
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
