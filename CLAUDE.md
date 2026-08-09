# 메모짱 작업 지침

픽셀 글꼴 무한 캔버스 메모 앱. Tauri v2 (Rust) + React 19 + TypeScript + zustand.
사람이 읽는 설명은 [README.md](README.md) 에 있습니다. 여기에는 **작업할 때 걸려 넘어졌던 것**만 적습니다.

## 밀기 전에

**나가면 안 되는 것이 `.gitignore` 에 들어 있는지 먼저 확인합니다.** 한 번 밀어 버린 것은
릴리스를 지워도 남습니다 — 포크, 클론, GitHub 캐시 어딘가에.

이미 걸러지고 있는 것:

- 빌드 산출물 — `node_modules`, `dist`, `src-tauri/target` (마지막은 `src-tauri/.gitignore` 담당)
- **캔버스 파일** — `*.mjb.json`, `*.mjb.assets/`. 저장소 안에서 앱을 굴리다 보면 여기에 저장되기 쉽고,
  그건 남의 할 일 목록입니다.
- 비밀 — `.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`
- `.claude/settings.local.json`

`.claude/hooks/guard-push.mjs` 가 `git push` 직전에 이걸 다시 봅니다. 걸리면 명령이 막히고
무엇이 문제인지 나옵니다. 훅은 안전망이지 관문이 아니므로, 새 종류의 산출물이 생기면
**훅이 아니라 `.gitignore` 를 먼저** 고칩니다.

## 고쳤으면 다시 빌드해서 봅니다

`npx tsc --noEmit` 은 타입만 봅니다. **화면 동작을 확인하려면 반드시 다시 빌드해야 합니다.**

```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"   # cargo 가 PATH 에 없는 셸이 있습니다
npm run tauri build
```

이걸 건너뛰고 예전 `target/release/memojjang.exe` 를 열어 놓고 "고쳤는데 안 된다" 로
시간을 버린 적이 여러 번 있습니다. UI 만 만질 때는 `npm run dev` 로 브라우저에서 봐도 되지만,
트레이·전역 단축키·파일 저장·클립보드는 실제 앱에서만 동작합니다.

## 화면을 확인할 때

- 창을 찍을 때는 `PrintWindow`(플래그 2, `PW_RENDERFULLCONTENT`)를 씁니다. 포커스가 없어도,
  다른 창에 가려져 있어도 그 창만 정확히 나옵니다. **바탕화면 전체를 찍지 않습니다** — 사용자의
  다른 창이 들어갑니다.
- 마우스·키보드를 흉내 내기 전에 `GetForegroundWindow` / `WindowFromPoint` 로 그 자리가 정말
  이 앱인지 확인합니다. 사용자가 같은 컴퓨터를 쓰고 있습니다.
- 화면 배율이 100% 가 아닌 경우가 있습니다. 크기를 재는 쪽에서 `SetProcessDPIAware` 를 부르지 않으면
  창 좌표와 실제 픽셀이 어긋납니다.
- **스크린샷에 사용자의 실제 보드가 나오면 안 됩니다.** 시연용 캔버스를 따로 만들어 찍고,
  끝나면 `%APPDATA%\com.memojjang.app\workspace.json` 을 원래대로 되돌리고 시연 파일을 지웁니다.

## 릴리스

버전은 `src-tauri/tauri.conf.json` 과 `package.json` 두 곳에 있습니다. **둘 다** 올린 뒤:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

`.github/workflows/release.yml` 이 윈도우에서 빌드해 Releases 에 **초안**으로 올립니다.
내용을 확인하고 GitHub 에서 직접 Publish 를 눌러야 공개됩니다.

## 코드에서 지키는 것

- 좌표는 하나뿐입니다: `화면 = 월드 × zoom + viewport{x,y}`. `transform` 은 `.board__world`
  래퍼 한 겹에만 겁니다. 노트마다 걸면 z-index 와 성능이 함께 무너집니다.
- 테마 색은 `src/theme/palette.ts` 가 유일한 출처입니다. CSS 에 색을 직접 적지 않습니다.
- 사용자가 넣은 글은 React 엘리먼트로만 그립니다. HTML 미리보기는 `sandbox=""` iframe 안에서만.
- 주석은 **왜** 를 적습니다. 코드를 다시 읽으면 알 수 있는 것은 적지 않습니다.
