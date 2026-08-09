#!/usr/bin/env node
/** git push 직전에, 나가면 안 되는 것이 딸려 나가는지 본다.
 *
 *  한 번 밀어 버린 것은 지워도 남는다(포크·캐시·클론). 그래서 되돌릴 수 없는 쪽에
 *  문턱을 둔다. 걸리면 exit 2 로 막고 무엇이 문제인지 알려 준다.
 *
 *  훅 자체가 고장 나서 작업을 막는 일은 없어야 하므로, 판단할 수 없는 상황이면
 *  조용히 통과시킨다(exit 0). 이건 안전망이지 관문이 아니다. */
import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'

/** 추적되고 있으면 안 되는 것들. */
const FORBIDDEN = [
  [/^node_modules\//, '의존성 폴더'],
  [/^dist\//, '프런트엔드 빌드 산출물'],
  [/(^|\/)target\//, 'Rust 빌드 산출물'],
  [/\.mjb\.json$/, '개인 캔버스 파일'],
  [/\.mjb\.assets\//, '개인 캔버스에 붙인 그림'],
  [/(^|\/)\.env(\.|$)/, '환경 변수 파일'],
  [/\.(pem|key|p12|pfx)$/, '서명 키·인증서'],
  [/(^|\/)settings\.local\.json$/, '이 컴퓨터에서만 쓰는 설정'],
]

/** GitHub 는 100MB 를 아예 거절하고 50MB 부터 경고한다. */
const MAX_BYTES = 50 * 1024 * 1024

const read = () =>
  new Promise((resolve) => {
    let buf = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (buf += chunk))
    process.stdin.on('end', () => resolve(buf))
    // stdin 이 끝내 닫히지 않는 경우까지 기다리지는 않는다.
    setTimeout(() => resolve(buf), 3000).unref?.()
  })

const main = async () => {
  let command = ''
  try {
    // 앞머리의 BOM 은 JSON.parse 가 못 넘긴다. 파이프로 넣어 볼 때 붙는 일이 있다.
    const payload = JSON.parse((await read()).replace(/^﻿/, ''))
    command = String(payload?.tool_input?.command ?? '')
  } catch {
    return 0
  }

  // git push 일 때만 본다. 주석에 'push' 가 스쳐 지나가는 정도로는 걸리지 않게 붙여서 본다.
  if (!/\bgit\b[^\n]*\bpush\b/.test(command)) return 0

  let tracked
  try {
    // -z 로 받아야 한다. 그냥 받으면 한글 이름이 "\353\202\264…" 처럼 따옴표에 싸여 나와서
    // 확장자로 거는 규칙이 전부 빗나간다 — 정작 막아야 할 '내 보드.mjb.json' 이 새어 나간다.
    tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
  } catch {
    return 0
  }

  const problems = []

  for (const path of tracked) {
    for (const [pattern, why] of FORBIDDEN) {
      if (pattern.test(path)) {
        problems.push(`${path} — ${why}`)
        break
      }
    }
  }

  for (const path of tracked) {
    try {
      const { size } = statSync(path)
      if (size > MAX_BYTES) {
        problems.push(`${path} — ${Math.round(size / 1024 / 1024)}MB, 너무 큽니다`)
      }
    } catch {
      // 지워졌거나 읽을 수 없는 것은 넘어간다.
    }
  }

  if (!problems.length) return 0

  const seen = [...new Set(problems)]
  const shown = seen.slice(0, 20)
  process.stderr.write(
    ['밀기 전에 저장소에서 빼야 할 것이 추적되고 있습니다:', '', ...shown.map((p) => `  - ${p}`)]
      .concat(seen.length > shown.length ? [`  … 그리고 ${seen.length - shown.length}개 더`] : [])
      .concat([
        '',
        '.gitignore 에 넣고 색인에서 빼낸 뒤 다시 시도하세요:',
        '',
        '  git rm -r --cached <경로>',
        '',
        '이미 커밋에 들어간 것이라면 밀기 전에 히스토리에서 지워야 합니다.',
        '한 번 올라간 것은 릴리스를 지워도 클론과 캐시에 남습니다.',
      ])
      .join('\n') + '\n',
  )
  return 2
}

main().then(
  (code) => process.exit(code),
  () => process.exit(0),
)
