//! 사용자가 고른 임의 경로의 파일 읽기·쓰기.
//!
//! fs 플러그인을 쓰지 않는 이유: 그쪽은 미리 정해둔 폴더(앱 데이터 등)로 범위가 묶여 있는데,
//! 캔버스 파일은 사용자가 D 드라이브든 어디든 원하는 자리에 둘 수 있어야 한다.
//! 앱 데이터 안의 설정·작업공간 파일은 그대로 fs 플러그인이 맡는다.
//!
//! 이미지는 base64 문자열로 주고받는다. 붙여넣을 때와 화면에 처음 띄울 때만 오가므로
//! 그 정도 변환 비용은 문제가 되지 않고, 대신 IPC 경계가 단순해진다.

use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;

fn describe(path: &Path, err: std::io::Error) -> String {
    format!("{} — {err}", path.display())
}

/// 쓰기 전에 상위 폴더를 준비한다. 사이드카 폴더가 아직 없을 수 있다.
fn ensure_parent(path: &Path) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Ok(());
    };
    if parent.as_os_str().is_empty() || parent.exists() {
        return Ok(());
    }
    std::fs::create_dir_all(parent).map_err(|err| describe(parent, err))
}

/// 파일이 없으면 `None`. 없는 것과 못 읽는 것은 부르는 쪽에서 구분해야 한다.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(&path)
        .map(Some)
        .map_err(|err| describe(&path, err))
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    ensure_parent(&path)?;
    std::fs::write(&path, contents).map_err(|err| describe(&path, err))
}

#[tauri::command]
pub fn read_binary_file(path: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read(&path)
        .map(|bytes| Some(STANDARD.encode(bytes)))
        .map_err(|err| describe(&path, err))
}

#[tauri::command]
pub fn write_binary_file(path: String, base64_data: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    let bytes = STANDARD
        .decode(base64_data)
        .map_err(|err| format!("이미지 데이터를 해석하지 못했습니다: {err}"))?;
    ensure_parent(&path)?;
    std::fs::write(&path, bytes).map_err(|err| describe(&path, err))
}

/// 이미 없으면 성공으로 친다 — 지우려는 목적은 이미 이뤄진 셈이다.
#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Ok(());
    }
    std::fs::remove_file(&path).map_err(|err| describe(&path, err))
}

#[tauri::command]
pub fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// 폴더 안의 **파일 이름**들. 폴더는 빼고, 안쪽으로 들어가지도 않는다.
///
/// 없는 폴더는 빈 목록이다 — 그림을 한 장도 넣지 않은 캔버스에는 `.assets` 가 아예 없고,
/// 그건 잘못된 상태가 아니다.
#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(path);
    if !path.is_dir() {
        return Ok(Vec::new());
    }

    let entries = std::fs::read_dir(&path).map_err(|err| describe(&path, err))?;
    let mut names = Vec::new();
    for entry in entries.flatten() {
        if !entry.file_type().map(|kind| kind.is_file()).unwrap_or(false) {
            continue;
        }
        if let Some(name) = entry.file_name().to_str() {
            names.push(name.to_string());
        }
    }
    Ok(names)
}

/// 파일이든 폴더든 옮긴다. 예전 판에서 쓰던 그림 폴더를 새 자리로 데려올 때 쓴다.
#[tauri::command]
pub fn rename_path(from: String, to: String) -> Result<(), String> {
    let from = PathBuf::from(from);
    let to = PathBuf::from(to);
    if !from.exists() {
        return Ok(());
    }
    if to.exists() {
        return Err(format!("{} 가 이미 있습니다", to.display()));
    }
    ensure_parent(&to)?;
    std::fs::rename(&from, &to).map_err(|err| describe(&from, err))
}

/// 파일 탐색기에서 해당 파일이 있는 폴더를 열고 그 파일을 골라 준다.
#[tauri::command]
pub fn reveal_in_explorer(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .reveal_item_in_dir(PathBuf::from(path))
        .map_err(|err| format!("폴더를 열지 못했습니다: {err}"))
}
