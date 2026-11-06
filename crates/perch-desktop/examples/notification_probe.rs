//! Read-only native notification regression; run from a private .app bundle
//! (see docs/TESTING.md). No windows, core, daemon, permission prompt or alert.
#[cfg(target_os = "macos")]
#[path = "../src/notify.rs"]
#[allow(dead_code)]
mod notify;

fn main() {
    #[cfg(target_os = "macos")]
    {
        let mut context = tauri::generate_context!();
        context.config_mut().identifier = "dev.perch.notification-probe".into();
        let app = tauri::Builder::default()
            .setup(|app| {
                app.set_activation_policy(tauri::ActivationPolicy::Prohibited);
                notify::init(app.handle()).map_err(anyhow::Error::msg)?;
                use objc2_user_notifications::UNUserNotificationCenter;
                assert!(UNUserNotificationCenter::currentNotificationCenter()
                    .delegate()
                    .is_some());
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let result = async {
                        let status = notify::notification_status()
                            .await
                            .map_err(anyhow::Error::msg)?;
                        anyhow::ensure!(matches!(
                            status["permission"].as_str(),
                            Some("default" | "denied" | "granted" | "provisional" | "unknown")
                        ));
                        anyhow::ensure!(
                            status["alerts"].is_boolean()
                                && status["notificationCenter"].is_boolean()
                        );
                        anyhow::ensure!(matches!(
                            status["alertStyle"].as_str(),
                            Some("none" | "banner" | "alert" | "unknown")
                        ));
                        // This branch cannot enqueue an alert or request consent.
                        if matches!(status["permission"].as_str(), Some("default" | "denied")) {
                            anyhow::ensure!(notify::notify_session(
                                "Unused".into(),
                                "Unused".into(),
                                "probe".into()
                            )
                            .await
                            .is_err());
                        }
                        println!(
                            "PASS: native delegate retained; real notification settings: {status}"
                        );
                        Ok::<_, anyhow::Error>(())
                    }
                    .await;
                    if let Err(error) = &result {
                        eprintln!("FAIL: {error:#}");
                    }
                    handle.exit(if result.is_ok() { 0 } else { 1 });
                });
                Ok(())
            })
            .build(context)
            .expect("notification probe requires a private .app bundle");
        assert_eq!(
            app.run_return(|_, _| {}),
            0,
            "native notification probe failed"
        );
    }
    #[cfg(not(target_os = "macos"))]
    println!("SKIP: native notification probe is macOS-only");
}
