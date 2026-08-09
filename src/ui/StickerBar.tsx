/** 고른 스티커를 손보는 도구 줄.
 *
 *  캔버스 위에 떠 있지 않고 화면 아래에 붙어 있다. 캔버스 안에 두면 배율에 따라
 *  같이 줄어들어 잡기 어렵고, 슬라이더처럼 섬세한 것은 특히 그렇다.
 *  대신 노트에 이어 붙이는 손잡이만 스티커 곁에 남겨 뒀다 — 그건 자리가 뜻을 갖기 때문이다. */
import { STICKER_ANCHORS, STICKER_MIN_OPACITY, type StickerLayer, type StickerMask } from '../types'
import { useBoard } from '../store/boardStore'
import { useUi } from '../store/uiStore'
import { Icon } from './Icon'
import { useT, type MessageKey } from '../i18n'
import './stickerbar.css'

const LAYERS: { value: StickerLayer; labelKey: MessageKey; hintKey: MessageKey }[] = [
  { value: 'behind', labelKey: 'sticker.behind', hintKey: 'sticker.behindHint' },
  { value: 'body', labelKey: 'sticker.body', hintKey: 'sticker.bodyHint' },
  { value: 'front', labelKey: 'sticker.front', hintKey: 'sticker.frontHint' },
]

const MASKS: { value: StickerMask; label: string; hintKey: MessageKey }[] = [
  { value: 'none', label: '□', hintKey: 'sticker.shapeNone' },
  { value: 'circle', label: '○', hintKey: 'sticker.shapeCircle' },
  { value: 'star', label: '☆', hintKey: 'sticker.shapeStar' },
]

export function StickerBar({ id }: { id: string }) {
  const say = useT()
  const sticker = useBoard((s) => s.stickers[id])
  const attached = Boolean(sticker?.noteId)
  if (!sticker) return null

  const patch = useBoard.getState().patchSticker

  return (
    <div className="stbar bevel-out" role="toolbar" aria-label={say('sticker.bar')}>
      <span className="stbar__group">
        <span className="stbar__label">{say('sticker.place')}</span>
        {LAYERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className="btn stbar__btn"
            aria-pressed={sticker.layer === item.value}
            // 붙어 있지 않으면 '본문 밑' 이 갈 곳이 없다.
            disabled={item.value === 'body' && !attached}
            title={say(item.value === 'body' && !attached ? 'sticker.needNote' : item.hintKey)}
            onClick={() => patch(id, { layer: item.value })}
          >
            {say(item.labelKey)}
          </button>
        ))}
      </span>

      {/* 붙어 있을 때만 뜻이 있다. 노트 크기가 바뀌면 스티커가 이 자리를 따라간다. */}
      {attached && (
        <span className="stbar__group">
          <span className="stbar__label">{say('sticker.anchor')}</span>
          {STICKER_ANCHORS.map((spot) => (
            <button
              key={spot.value}
              type="button"
              className="btn stbar__btn"
              aria-pressed={sticker.anchor === spot.value}
              title={say(spot.hintKey)}
              onClick={() => useBoard.getState().setStickerAnchor(id, spot.value)}
            >
              {say(spot.labelKey)}
            </button>
          ))}
        </span>
      )}

      <span className="stbar__group">
        <span className="stbar__label">{say('sticker.opacity')}</span>
        <input
          className="stbar__range"
          type="range"
          min={STICKER_MIN_OPACITY * 100}
          max={100}
          step={1}
          value={Math.round(sticker.opacity * 100)}
          title={say('sticker.opacityHint')}
          onChange={(e) => patch(id, { opacity: Number(e.target.value) / 100 })}
        />
        {/* 슬라이더로는 '딱 40%' 를 맞추기 어렵다. 숫자로도 넣을 수 있게 둔다. */}
        <input
          className="stbar__num"
          type="number"
          min={STICKER_MIN_OPACITY * 100}
          max={100}
          step={1}
          value={Math.round(sticker.opacity * 100)}
          title={say('sticker.opacityType')}
          onChange={(e) => {
            // 지우는 중(빈 칸)에는 손대지 않는다. 0 으로 튕겨 나가면 다시 적기가 번거롭다.
            if (e.target.value === '') return
            const pct = Math.min(100, Math.max(STICKER_MIN_OPACITY * 100, Number(e.target.value)))
            if (Number.isFinite(pct)) patch(id, { opacity: pct / 100 })
          }}
        />
        <span className="stbar__label">%</span>
      </span>

      <button
        type="button"
        className="btn stbar__btn"
        aria-pressed={sticker.mono}
        title={say('sticker.monoHint')}
        onClick={() => patch(id, { mono: !sticker.mono })}
      >
        {say('sticker.mono')}
      </button>

      <span className="stbar__group">
        <span className="stbar__label">{say('sticker.shape')}</span>
        {MASKS.map((item) => (
          <button
            key={item.value}
            type="button"
            className="btn stbar__btn stbar__btn--shape"
            aria-pressed={sticker.mask === item.value}
            title={say(item.hintKey)}
            onClick={() => patch(id, { mask: item.value })}
          >
            {item.label}
          </button>
        ))}
      </span>

      <span className="stbar__gap" />

      <button
        type="button"
        className="btn stbar__btn"
        title={say('sticker.doneHint')}
        onClick={() => useUi.getState().pickSticker(null)}
      >
        {say('sticker.done')}
      </button>
      <button
        type="button"
        className="btn stbar__btn stbar__btn--danger"
        title={say('sticker.remove')}
        onClick={() => {
          useUi.getState().pickSticker(null)
          useBoard.getState().removeSticker(id)
        }}
      >
        <Icon name="trash" />
      </button>
    </div>
  )
}
