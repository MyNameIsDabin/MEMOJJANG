//! 웹에서 그림 한 장 받아오기.
//!
//! 브라우저에서 그림을 끌어다 놓으면 파일이 아니라 **주소**가 넘어온다. 그래서 받아와야 한다.
//! 웹뷰에서 fetch 로 받으면 될 것 같지만 안 된다 — 다른 출처의 응답은 CORS 에 막혀 내용을 읽을 수 없고,
//! `<img>` 로 그린 뒤 canvas 에서 꺼내려 해도 캔버스가 오염돼 막힌다.
//! 그래서 이쪽에서 받아 바이트를 그대로 넘긴다.

use std::io::Read;
use std::time::Duration;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;

/// 실수로 거대한 파일을 물고 오는 일을 막는다.
const MAX_BYTES: usize = 25 * 1024 * 1024;
const TIMEOUT: Duration = Duration::from_secs(20);

#[derive(serde::Serialize, Debug)]
pub struct FetchedImage {
    mime: String,
    base64: String,
}

#[tauri::command]
pub fn download_image(url: String) -> Result<FetchedImage, String> {
    // 파일 경로나 다른 스킴이 흘러 들어오지 않게 막는다.
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("http 또는 https 주소만 받을 수 있습니다".into());
    }

    let agent = ureq::AgentBuilder::new().timeout(TIMEOUT).build();
    let response = agent
        .get(&url)
        .call()
        .map_err(|err| format!("받아오지 못했습니다: {err}"))?;

    let mime = response
        .header("content-type")
        .unwrap_or_default()
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_lowercase();

    if !mime.starts_with("image/") {
        return Err(format!(
            "그림이 아닙니다 ({})",
            if mime.is_empty() { "형식을 알 수 없음" } else { &mime }
        ));
    }

    // 상한보다 한 바이트 더 읽어서, 넘쳤는지 알 수 있게 한다.
    let mut bytes = Vec::new();
    response
        .into_reader()
        .take((MAX_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|err| format!("읽는 중 끊겼습니다: {err}"))?;

    if bytes.len() > MAX_BYTES {
        return Err("그림이 너무 큽니다 (25MB 넘음)".into());
    }

    Ok(FetchedImage {
        mime,
        base64: STANDARD.encode(bytes),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 실제 망을 타므로 평소 실행에서는 빼둔다.
    /// 확인할 때: `cargo test -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn fetches_a_real_image() {
        let fetched = download_image("https://github.githubassets.com/favicons/favicon.png".into())
            .expect("그림을 받아오지 못했습니다");
        assert!(fetched.mime.starts_with("image/"), "mime={}", fetched.mime);
        assert!(fetched.base64.len() > 100, "내용이 너무 짧습니다");
        println!("받음: {} / base64 {}자", fetched.mime, fetched.base64.len());
    }

    #[test]
    #[ignore]
    fn rejects_a_page_that_is_not_an_image() {
        let error = download_image("https://example.com/".into()).unwrap_err();
        assert!(error.contains("그림이 아닙니다"), "예상 밖의 오류: {error}");
        println!("거절됨: {error}");
    }

    #[test]
    fn rejects_other_schemes() {
        assert!(download_image("file:///C:/secret.png".into()).is_err());
        assert!(download_image("javascript:alert(1)".into()).is_err());
    }
}
