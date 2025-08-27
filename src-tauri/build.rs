// SPDX-License-Identifier: Apache-2.0
fn main() {
  let epoch = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs().to_string();
  let sha = std::env::var("GITHUB_SHA").or_else(|_| std::env::var("GIT_COMMIT")).unwrap_or_else(|_| "unknown".into());
  println!("cargo:rustc-env=BUILD_EPOCH={}", epoch);
  println!("cargo:rustc-env=GIT_SHA={}", sha);
}

