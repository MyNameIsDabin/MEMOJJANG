/** 현지화.
 *
 *  한국어가 원본이다. `ko` 에 적힌 것이 곧 열쇠 목록이고, 다른 말은 그 일부만 채워도 된다 —
 *  빠진 것은 한국어로 나온다. 새 언어를 더하는 일이 "파일 하나 만들고 아래 목록에 한 줄"
 *  이면 끝나도록 이렇게 뒀다. 절반만 번역된 채로도 앱은 멀쩡히 돌아간다.
 *
 *  글꼴이 갈무리라서 지금은 갈무리가 담고 있는 글자(한글·라틴·가나)에 맞는 말만 올린다. */
import { useCallback } from 'react'
import { useSettings } from '../store/settingsStore'
import { ko } from './ko'
import { en } from './en'
import { ja } from './ja'

/** 열쇠는 한국어 사전에서 그대로 가져오되, 값은 그냥 글자다.
 *  `as const` 를 그대로 두면 값까지 리터럴로 굳어 다른 말을 넣을 수 없다. */
export type MessageKey = keyof typeof ko
export type Messages = Record<MessageKey, string>

/** 언어 하나를 더하려면 여기에 한 줄만 보태면 된다. */
const CATALOG = {
  ko: { label: '한국어', messages: ko as Partial<Messages> },
  en: { label: 'English', messages: en as Partial<Messages> },
  ja: { label: '日本語', messages: ja as Partial<Messages> },
}

export type Locale = keyof typeof CATALOG

export const LOCALES: { value: Locale; label: string }[] = (
  Object.keys(CATALOG) as Locale[]
).map((value) => ({ value, label: CATALOG[value].label }))

export const DEFAULT_LOCALE: Locale = 'ko'

export type Vars = Record<string, string | number>

/** `{n}` 같은 자리를 채운다. 없는 이름은 그대로 남겨 둔다 — 지워 버리면 무엇이 빠졌는지 모른다. */
function fill(text: string, vars: Vars): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  )
}

export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const text = CATALOG[locale]?.messages[key] ?? ko[key] ?? String(key)
  return vars ? fill(text, vars) : text
}

/** 컴포넌트에서. 언어를 바꾸면 이걸 쓴 곳이 다시 그려진다. */
export function useT() {
  const locale = useSettings((s) => s.locale)
  return useCallback((key: MessageKey, vars?: Vars) => translate(locale, key, vars), [locale])
}

/** 컴포넌트 밖(액션·토스트)에서. 그때그때 지금 언어를 읽는다. */
export function t(key: MessageKey, vars?: Vars): string {
  return translate(useSettings.getState().locale, key, vars)
}

/** 수가 1일 때만 다른 말을 쓰는 언어가 있다. 열쇠를 둘로 나눠 두고 여기서 고른다. */
export function plural(n: number, one: MessageKey, many: MessageKey, vars?: Vars): string {
  return t(n === 1 ? one : many, { n, ...vars })
}
