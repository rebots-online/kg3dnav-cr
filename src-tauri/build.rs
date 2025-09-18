// SPDX-License-Identifier: Apache-2.0
use std::time::{SystemTime, UNIX_EPOCH};

fn format_build_number(minutes: u64) -> String {
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
}

fn main() {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time went backwards");
    let epoch_seconds = now.as_secs();
    let epoch_minutes = epoch_seconds / 60;
    let build_number = format_build_number(epoch_minutes);
    let sha = std::env::var("GITHUB_SHA")
        .or_else(|_| std::env::var("GIT_COMMIT"))
        .unwrap_or_else(|_| "unknown".into());

    println!("cargo:rustc-env=BUILD_MINUTES={}", epoch_minutes);
    println!("cargo:rustc-env=BUILD_NUMBER={}", build_number);
    println!(
        "cargo:rustc-env=BUILD_EPOCH={}",
        epoch_minutes.saturating_mul(60)
    );
    println!("cargo:rustc-env=GIT_SHA={}", sha);
}
