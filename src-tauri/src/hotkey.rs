//! 전역 단축키 — 어느 프로그램을 쓰고 있든 메모짱을 불러내고 다시 숨긴다.
//!
//! 프론트가 아니라 여기서 다루는 이유: 창이 숨겨져 있을 때도 확실히 동작해야 하고,
//! 그게 이 기능의 존재 이유이기 때문이다.

use std::str::FromStr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub const DEFAULT_ACCELERATOR: &str = "CommandOrControl+Shift+Space";

/// 창이 지금 앞에 있는지.
///
/// `Window::is_focused()` 를 그때그때 물어보는 방법도 있지만, 그쪽은 웹뷰 기준이라
/// 운영체제가 보는 포커스와 어긋날 때가 있다. 실제로 창이 앞에 있는데도 false 가 나와
/// 단축키를 처음 눌렀을 때 숨겨지지 않는 일이 있었다. 그래서 창 이벤트로 직접 따라간다.
static FOCUSED: AtomicBool = AtomicBool::new(false);

pub fn note_focus_changed(focused: bool) {
    FOCUSED.store(focused, Ordering::Relaxed);
}

/// 지금 등록되어 있는 단축키. 새로 걸기 전에 이전 것을 풀어야 하므로 들고 있는다.
static CURRENT: Mutex<Option<Shortcut>> = Mutex::new(None);

/// `None` 을 주면 단축키를 끈다.
pub fn apply<R: Runtime>(app: &AppHandle<R>, accelerator: Option<&str>) -> Result<(), String> {
    let manager = app.global_shortcut();
    let mut current = CURRENT.lock().map_err(|_| "단축키 상태가 잠겨 있습니다".to_string())?;

    if let Some(previous) = current.take() {
        let _ = manager.unregister(previous);
    }

    let Some(accelerator) = accelerator else {
        return Ok(());
    };

    let shortcut = Shortcut::from_str(accelerator)
        .map_err(|err| format!("'{accelerator}' 를 단축키로 읽지 못했습니다: {err}"))?;

    manager
        .on_shortcut(shortcut, |app, _shortcut, event| {
            // 누를 때만 반응한다. 뗄 때까지 받으면 한 번에 두 번 토글된다.
            if event.state == ShortcutState::Pressed {
                toggle(app);
            }
        })
        .map_err(|err| {
            format!("'{accelerator}' 를 등록하지 못했습니다 — 다른 프로그램이 쓰고 있을 수 있습니다: {err}")
        })?;

    *current = Some(shortcut);
    Ok(())
}

/// 보이면서 앞에 있으면 숨기고, 아니면 불러낸다.
fn toggle<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let visible = window.is_visible().unwrap_or(false);
    let minimized = window.is_minimized().unwrap_or(false);

    if visible && !minimized && FOCUSED.load(Ordering::Relaxed) {
        let _ = window.hide();
        return;
    }

    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();

    // Windows 에서는 이것만으로 모자란다. 아래 설명 참고.
    #[cfg(windows)]
    force_foreground(&window);
}

/// 창을 진짜로 맨 앞에 세운다.
///
/// Windows 는 지금 쓰고 있는 프로그램에서 포커스가 갑자기 튀는 것을 막으려고,
/// 배경 프로세스의 `SetForegroundWindow` 를 조용히 무시한다. 그래서 `set_focus()` 를 불러도
/// 창이 다른 창 뒤에 그대로 깔려 있는 일이 생긴다 — 하필 이 기능이 가장 필요한 상황,
/// 그러니까 다른 프로그램에서 일하다 메모짱을 부를 때가 정확히 그 경우다.
///
/// 런처류가 쓰는 우회법은 이렇다. 지금 앞에 있는 창의 스레드에 우리 스레드를 잠깐 붙이면
/// 두 스레드가 입력 큐를 공유하게 되고, 그동안은 포커스 이동이 허용된다.
#[cfg(windows)]
fn force_foreground<R: Runtime>(window: &tauri::WebviewWindow<R>) {
    use std::ffi::c_void;
    use windows_sys::Win32::System::Threading::AttachThreadInput;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::SetFocus;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, GetForegroundWindow, GetWindowThreadProcessId, SetForegroundWindow,
    };

    let Ok(handle) = window.hwnd() else {
        return;
    };
    let hwnd = handle.0 as isize as *mut c_void;

    unsafe {
        let foreground = GetForegroundWindow();
        if foreground == hwnd {
            return;
        }

        let ours = GetWindowThreadProcessId(hwnd, std::ptr::null_mut());
        let theirs = GetWindowThreadProcessId(foreground, std::ptr::null_mut());

        // 같은 스레드면 붙일 필요가 없고, 붙이면 오히려 실패한다.
        let attached = ours != theirs && theirs != 0 && AttachThreadInput(ours, theirs, 1) != 0;

        SetForegroundWindow(hwnd);
        BringWindowToTop(hwnd);
        SetFocus(hwnd);

        if attached {
            AttachThreadInput(ours, theirs, 0);
        }
    }
}
