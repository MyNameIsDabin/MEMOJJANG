/** JSON 을 보기 좋게 들여쓰고 색을 입혀 보여준다.
 *
 *  여기서도 HTML 문자열을 만들지 않는다. 조각마다 <span> 을 직접 붙이므로
 *  붙여넣은 글이 무엇이든 글자로만 남는다. */
import { useMemo } from 'react'
import { prettyJson, tokenizeJson } from './jsonTokens'

export function JsonView({ text }: { text: string }) {
  const { body, broken } = useMemo(() => prettyJson(text), [text])
  const pieces = useMemo(() => tokenizeJson(body), [body])

  return (
    <div className="json">
      {broken && <p className="json__broken">JSON 으로 읽히지 않아 들여쓰기는 그대로 둡니다.</p>}
      <pre className="json__body">
        {pieces.map((piece, i) =>
          piece.kind === 'plain' ? (
            piece.text
          ) : (
            <span key={i} className={`json__${piece.kind}`}>
              {piece.text}
            </span>
          ),
        )}
      </pre>
    </div>
  )
}
