/** 붙여넣은 글의 종류를 어떻게 알아낼지 정하는 곳.
 *
 *  규칙을 두 층으로 보여 준다.
 *  - 내장 규칙: 판단이 여러 신호의 합이라 글로 적기 어렵다. 켜기/끄기만 연다.
 *  - 내 규칙: 조건 하나짜리로 단순하게. 대신 내장보다 먼저 본다.
 *
 *  정규식을 모르는 사람도 쓸 수 있도록 규칙마다 **시험 입력칸**을 붙였다.
 *  글을 넣어 보면 지금 이 규칙에 걸리는지 그 자리에서 보인다. */
import { useState } from 'react'
import { newId, type MemoView } from '../types'
import { useSettings } from '../store/settingsStore'
import { BUILTIN_RULES, VIEW_LABEL, isValidRegex, matchesUserRule, type UserRule } from '../notes/detect'
import { Icon } from './Icon'
import './memoRules.css'

const VIEWS: MemoView[] = ['plain', 'markdown', 'code', 'html']

const WHEN_LABEL: Record<UserRule['when'], string> = {
  startsWith: '이 글자로 시작하면',
  contains: '이 글자가 들어 있으면',
  regex: '정규식과 맞으면',
}

export function MemoRules() {
  const autoDetect = useSettings((s) => s.memoAutoDetect)
  const disabled = useSettings((s) => s.memoDisabledBuiltins)
  const rules = useSettings((s) => s.memoUserRules)

  const setRules = (next: UserRule[]) => useSettings.getState().set('memoUserRules', next)

  const toggleBuiltin = (id: string, on: boolean) => {
    const next = on ? disabled.filter((x) => x !== id) : [...disabled, id]
    useSettings.getState().set('memoDisabledBuiltins', next)
  }

  const addRule = () =>
    setRules([
      ...rules,
      { id: newId(), label: '새 규칙', view: 'code', when: 'startsWith', value: '' },
    ])

  return (
    <div className="rules">
      <p className="settings__note">
        붙여넣은 글이 무엇인지 알아내는 차례입니다. <b>내 규칙이 먼저</b>이고, 위에서부터 먼저 맞는
        규칙이 이깁니다. 아무것도 맞지 않으면 '그대로'로 둡니다.
      </p>

      <h3 className="rules__title">내 규칙</h3>
      {rules.length === 0 && <p className="settings__note">아직 없습니다. 아래에서 만들 수 있습니다.</p>}
      {rules.map((rule, index) => (
        <RuleCard
          key={rule.id}
          rule={rule}
          first={index === 0}
          last={index === rules.length - 1}
          onChange={(next) => setRules(rules.map((r) => (r.id === rule.id ? next : r)))}
          onRemove={() => setRules(rules.filter((r) => r.id !== rule.id))}
          onMove={(delta) => {
            const next = [...rules]
            const to = index + delta
            if (to < 0 || to >= next.length) return
            ;[next[index], next[to]] = [next[to], next[index]]
            setRules(next)
          }}
        />
      ))}
      <button type="button" className="btn rules__add" onClick={addRule}>
        + 규칙 만들기
      </button>

      <h3 className="rules__title">내장 규칙</h3>
      <p className="settings__note">
        여러 신호를 함께 재서 판단합니다. 조건은 고칠 수 없고 켜고 끌 수 있습니다.
      </p>
      {BUILTIN_RULES.map((rule) => (
        <label key={rule.id} className="check rules__builtin">
          <input
            type="checkbox"
            checked={!disabled.includes(rule.id)}
            disabled={!autoDetect}
            onChange={(e) => toggleBuiltin(rule.id, e.target.checked)}
          />
          <span className="check__box" aria-hidden>
            {disabled.includes(rule.id) ? '' : '✔'}
          </span>
          <span className="check__text">
            {rule.label} → {VIEW_LABEL[rule.view]}
            <span className="check__note">{rule.note}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

function RuleCard({
  rule,
  first,
  last,
  onChange,
  onRemove,
  onMove,
}: {
  rule: UserRule
  first: boolean
  last: boolean
  onChange: (next: UserRule) => void
  onRemove: () => void
  onMove: (delta: number) => void
}) {
  const [sample, setSample] = useState('')
  const badRegex = rule.when === 'regex' && rule.value.trim() !== '' && !isValidRegex(rule.value)
  const hit = sample.trim() !== '' && !badRegex && matchesUserRule(rule, sample)

  return (
    <div className="rulecard">
      <div className="rulecard__head">
        <input
          className="rulecard__name"
          value={rule.label}
          placeholder="규칙 이름"
          onChange={(e) => onChange({ ...rule, label: e.target.value })}
        />
        <button type="button" className="rulecard__act" title="위로" disabled={first} onClick={() => onMove(-1)}>
          ▲
        </button>
        <button type="button" className="rulecard__act" title="아래로" disabled={last} onClick={() => onMove(1)}>
          ▼
        </button>
        <button type="button" className="rulecard__act rulecard__act--drop" title="지우기" onClick={onRemove}>
          <Icon name="close" />
        </button>
      </div>

      <div className="rulecard__row">
        <select
          className="rulecard__select"
          value={rule.when}
          onChange={(e) => onChange({ ...rule, when: e.target.value as UserRule['when'] })}
        >
          {(Object.keys(WHEN_LABEL) as UserRule['when'][]).map((when) => (
            <option key={when} value={when}>
              {WHEN_LABEL[when]}
            </option>
          ))}
        </select>
        <input
          className={`rulecard__value${badRegex ? ' rulecard__value--bad' : ''}`}
          value={rule.value}
          placeholder={rule.when === 'regex' ? '예: ^\\s*SELECT\\s' : '예: <?xml'}
          spellCheck={false}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
        />
      </div>

      <div className="rulecard__row">
        <span className="rulecard__arrow">→ 이렇게 보기</span>
        <select
          className="rulecard__select"
          value={rule.view}
          onChange={(e) => onChange({ ...rule, view: e.target.value as MemoView })}
        >
          {VIEWS.map((v) => (
            <option key={v} value={v}>
              {VIEW_LABEL[v]}
            </option>
          ))}
        </select>
      </div>

      {badRegex && <p className="rulecard__bad">정규식을 읽을 수 없습니다. 특수문자 앞에는 \\ 를 붙여 보세요.</p>}

      {/* 규칙이 제대로 걸리는지 그 자리에서 시험해 본다 — 정규식을 몰라도 감으로 맞출 수 있게 */}
      <div className="rulecard__try">
        <input
          className="rulecard__value"
          value={sample}
          placeholder="여기에 글을 넣어 시험해 보세요"
          spellCheck={false}
          onChange={(e) => setSample(e.target.value)}
        />
        <span className={`rulecard__verdict${hit ? ' rulecard__verdict--hit' : ''}`}>
          {sample.trim() === '' ? '—' : hit ? '걸림' : '안 걸림'}
        </span>
      </div>
    </div>
  )
}
