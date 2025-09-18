// SPDX-License-Identifier: Apache-2.0
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;

fn build_number_from_minutes(minutes_str: &str) -> String {
    if let Ok(minutes) = minutes_str.parse::<u64>() {
        let mut value = minutes;
        let mut digits: Vec<char> = Vec::new();
        if value == 0 {
            digits.push('0');
        } else {
            while value > 0 {
                let rem = (value % 36) as u8;
                let ch = match rem {
                    0..=9 => (b'0' + rem) as char,
                    _ => (b'A' + (rem - 10)) as char,
                };
                digits.push(ch);
                value /= 36;
            }
            digits.reverse();
        }
        let candidate: String = digits.into_iter().collect();
        let tail = if candidate.len() > 5 {
            candidate[candidate.len() - 5..].to_string()
        } else {
            candidate
        };
        format!("{:0>5}", tail)
    } else {
        "00000".into()
    }
}

#[derive(Serialize)]
struct BuildInfo {
    #[serde(rename = "buildNumber")]
    build_number: String,
    #[serde(rename = "epochMinutes")]
    epoch_minutes: String,
    epoch: String,
    semver: String,
    #[serde(rename = "gitSha")]
    git_sha: String,
}

#[tauri::command]
fn get_build_info() -> BuildInfo {
    let epoch_minutes = option_env!("BUILD_MINUTES").unwrap_or("0").to_string();
    let build_number = option_env!("BUILD_NUMBER")
        .map(|s| s.to_string())
        .unwrap_or_else(|| build_number_from_minutes(&epoch_minutes));
    let epoch_seconds = option_env!("BUILD_EPOCH").unwrap_or("0").to_string();
    let semver = env!("CARGO_PKG_VERSION").to_string();
    let git_sha = option_env!("GIT_SHA").unwrap_or("unknown").to_string();

    BuildInfo {
        build_number,
        epoch_minutes,
        epoch: epoch_seconds,
        semver,
        git_sha,
    }
}

fn main() {
    let mut builder =
        tauri::Builder::default().invoke_handler(tauri::generate_handler![get_build_info]);

    // Simple menu emitting events for UI to handle
    #[cfg(not(target_os = "android"))]
    {
        use tauri::{
            menu::{Menu, MenuItem},
            AppHandle,
        };
        let about = MenuItem::with_id("about", "About", true, None::<&str>).unwrap();
        let set_layout_concept = MenuItem::with_id(
            "set_layout_concept",
            "Concept-Centric Layout",
            true,
            None::<&str>,
        )
        .unwrap();
        let set_layout_sphere =
            MenuItem::with_id("set_layout_sphere", "Sphere Layout", true, None::<&str>).unwrap();
        let set_layout_grid =
            MenuItem::with_id("set_layout_grid", "Grid Layout", true, None::<&str>).unwrap();
        let toggle_xray =
            MenuItem::with_id("toggle_xray", "Toggle X-Ray", true, None::<&str>).unwrap();
        let reset_camera =
            MenuItem::with_id("reset_camera", "Reset Camera", true, None::<&str>).unwrap();
        let toggle_sidebar =
            MenuItem::with_id("toggle_sidebar", "Toggle Sidebar", true, None::<&str>).unwrap();

        let menu = Menu::with_items(&[
            about.clone().into(),
            set_layout_concept.clone().into(),
            set_layout_sphere.clone().into(),
            set_layout_grid.clone().into(),
            toggle_xray.clone().into(),
            reset_camera.clone().into(),
            toggle_sidebar.clone().into(),
        ])
        .unwrap();

        builder = builder
            .menu(menu)
            .on_menu_event(|app, ev| match ev.id().as_ref() {
                "about" => {
                    let _ = app.emit("about", ());
                }
                "set_layout_concept" => {
                    let _ = app.emit("set-layout", "concept-centric");
                }
                "set_layout_sphere" => {
                    let _ = app.emit("set-layout", "sphere");
                }
                "set_layout_grid" => {
                    let _ = app.emit("set-layout", "grid");
                }
                "toggle_xray" => {
                    let _ = app.emit("toggle-xray", ());
                }
                "reset_camera" => {
                    let _ = app.emit("reset-camera", ());
                }
                "toggle_sidebar" => {
                    let _ = app.emit("toggle-sidebar", ());
                }
                _ => {}
            });
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
