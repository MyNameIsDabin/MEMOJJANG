/** 글꼴 더하기·빼기.
 *
 *  글꼴은 두 가지 값을 함께 알아야 제대로 보인다. 도트 글꼴인지(안티에일리어싱을 끌지),
 *  그리고 몇 px 로 그리도록 만들어진 글꼴인지다. 이건 파일만 봐서는 알 수 없어서 물어본다. */
import { useState } from 'react'
import { useSettings, type UserFont } from '../store/settingsStore'
import { addFontByName, addFontFromFile, removeUserFont } from '../platform/fonts'
import { isTauri } from '../platform/env'
import { notify } from './toast'
import { Icon } from './Icon'

export function FontManager() {
  const userFonts = useSettings((s) => s.userFonts)
  const [name, setName] = useState('')
  const [basePx, setBasePx] = useState(13)
  const [pixel, setPixel] = useState(false)
  const [busy, setBusy] = useState(false)

  const add = (font: UserFont) => {
    const { set, userFonts: current } = useSettings.getState()
    set('userFonts', [...current, font])
    // 더하자마자 그 글꼴로 바꿔 준다 — 더한 이유가 그것이기 때문이다.
    set('font', font.key)
    setName('')
  }

  const fromFile = async () => {
    setBusy(true)
    try {
      const font = await addFontFromFile({ basePx, pixel })
      if (font) add(font)
    } catch (err) {
      notify(`글꼴을 더하지 못했습니다: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const fromName = () => {
    try {
      add(addFontByName(name, { basePx, pixel }))
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err))
    }
  }

  const drop = async (font: UserFont) => {
    const { set, userFonts: current, font: chosen } = useSettings.getState()
    set('userFonts', current.filter((f) => f.key !== font.key))
    // 쓰던 글꼴을 지웠으면 기본으로 되돌린다. 안 그러면 아무 글꼴도 안 걸린다.
    if (chosen === font.key) set('font', 'galmuri11')
    await removeUserFont(font)
  }

  return (
    <div className="fontadd bevel-in">
      <div className="fontadd__row">
        <label className="fontadd__field">
          <span>기준 크기</span>
          <input
            type="number"
            min={6}
            max={40}
            value={basePx}
            onChange={(e) => setBasePx(Math.min(40, Math.max(6, Number(e.target.value) || 13)))}
          />
          <span>px</span>
        </label>

        <label className="check check--inline">
          <input type="checkbox" checked={pixel} onChange={(e) => setPixel(e.target.checked)} />
          <span className="check__box" aria-hidden>
            {pixel ? '✔' : ''}
          </span>
          <span className="check__text">도트 글꼴</span>
        </label>
      </div>

      <p className="settings__note">
        도트 글꼴로 표시하면 흐림 처리를 끕니다. 기준 크기는 그 글꼴이 그려지도록 만들어진 픽셀
        크기이며, 위의 글자 크기 배율이 여기에 곱해집니다.
      </p>

      <div className="fontadd__row">
        <input
          className="fontadd__name"
          value={name}
          placeholder="이 컴퓨터에 깔린 글꼴 이름 (예: D2Coding)"
          spellCheck={false}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              e.preventDefault()
              fromName()
            }
          }}
        />
        <button className="btn" disabled={!name.trim()} onClick={fromName}>
          이름으로 더하기
        </button>
      </div>

      <div className="settings__actions">
        <button className="btn" disabled={!isTauri() || busy} onClick={() => void fromFile()}>
          글꼴 파일 불러오기…
        </button>
      </div>
      <p className="settings__note">
        불러온 파일은 앱 데이터 폴더로 복사해 둡니다. 원본을 옮기거나 지워도 그대로 남습니다.
      </p>

      {userFonts.length > 0 && (
        <ul className="fontadd__list">
          {userFonts.map((font) => (
            <li key={font.key} className="fontadd__item">
              <span className="fontadd__label" style={{ fontFamily: `"${font.family}", monospace` }}>
                {font.label}
              </span>
              <span className="fontadd__meta">
                {font.file ? '파일' : '설치됨'} · {font.basePx}px{font.pixel ? ' · 도트' : ''}
              </span>
              <button
                type="button"
                className="note__ctl note__ctl--close"
                title="목록에서 빼기"
                onClick={() => void drop(font)}
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
