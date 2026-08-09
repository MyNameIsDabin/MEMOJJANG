#[cfg(desktop)]
mod clipboard_watch;
mod files;
#[cfg(desktop)]
mod hotkey;
mod net;
#[cfg(desktop)]
mod tray;

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::WindowEvent;

/// 닫기 버튼의 뜻 — 참이면 숨기기, 거짓이면 진짜 종료.
/// 설정 화면에서 바꾸며, 기본값은 settingsStore 의 minimizeToTray 와 맞춰 둔다.
static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(true);

#[tauri::command]
fn set_close_to_tray(enabled: bool) {
    CLOSE_TO_TRAY.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
fn set_clipboard_watch(enabled: bool) {
    #[cfg(desktop)]
    clipboard_watch::set_enabled(enabled);
    #[cfg(not(desktop))]
    let _ = enabled;
}

/// `accelerator` 가 없으면 전역 단축키를 끈다.
/// 실패 이유는 그대로 프론트로 올려 사용자에게 보여 준다 — 대개 다른 앱과 겹친 경우다.
#[tauri::command]
fn set_global_hotkey(_app: tauri::AppHandle, accelerator: Option<String>) -> Result<(), String> {
    #[cfg(desktop)]
    return hotkey::apply(&_app, accelerator.as_deref());
    #[cfg(not(desktop))]
    {
        let _ = accelerator;
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| {
            #[cfg(desktop)]
            {
                _app.handle()
                    .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
                _app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                _app.handle().plugin(tauri_plugin_process::init())?;
                tray::init(_app.handle())?;
                clipboard_watch::spawn(_app.handle().clone());
                // 설정을 읽은 프론트가 곧 정확한 값으로 다시 걸어 준다.
                // 그 전까지의 짧은 순간에도 기본 단축키는 살아 있도록 여기서 미리 건다.
                if let Err(err) = hotkey::apply(_app.handle(), Some(hotkey::DEFAULT_ACCELERATOR)) {
                    eprintln!("[hotkey] {err}");
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                if CLOSE_TO_TRAY.load(Ordering::Relaxed) {
                    // 종료를 막고 숨기기만 한다. 트레이 메뉴의 "종료" 로 완전히 끌 수 있다.
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            // 전역 단축키가 "숨길지 불러낼지" 판단하는 근거가 된다.
            #[cfg(desktop)]
            WindowEvent::Focused(focused) => hotkey::note_focus_changed(*focused),
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            set_close_to_tray,
            set_clipboard_watch,
            set_global_hotkey,
            files::read_text_file,
            files::write_text_file,
            files::read_binary_file,
            files::write_binary_file,
            files::delete_file,
            files::file_exists,
            files::rename_path,
            files::reveal_in_explorer,
            net::download_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
