/** 이벤트가 글자를 입력하는 칸에서 났는지 판별한다.
 *  단축키와 붙여넣기가 입력 중인 텍스트를 가로채지 않도록 하는 데 쓴다. */
export function isTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el?.tagName) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || el.isContentEditable
}
