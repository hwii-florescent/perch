//! Tests for who may talk to a booted core (slice 3a): nobody without a token, not even from
//! loopback. The rule itself is `authorize_request` in `mod.rs`; the credential is
//! `crate::local_ui`.
use super::*;
use crate::agent_fleet::AgentKey;
use crate::agent_identity::IdentityStore;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

/// One raw HTTP exchange with a booted core: status, the response head, and the body text.
async fn http(
    address: SocketAddr,
    method: &str,
    path: &str,
    headers: &[(&str, &str)],
) -> (u16, String, String) {
    let mut text = format!(
        "{method} {path} HTTP/1.0\r\nHost: 127.0.0.1:{}\r\nContent-Length: 0\r\n",
        address.port()
    );
    for (name, value) in headers {
        text.push_str(&format!("{name}: {value}\r\n"));
    }
    text.push_str("\r\n");
    let mut stream = tokio::net::TcpStream::connect(address).await.unwrap();
    stream.write_all(text.as_bytes()).await.unwrap();
    let mut response = Vec::new();
    stream.read_to_end(&mut response).await.unwrap();
    let response = String::from_utf8_lossy(&response).into_owned();
    let (head, body) = response.split_once("\r\n\r\n").unwrap();
    let status = head.split_whitespace().nth(1).unwrap().parse().unwrap();
    (status, head.to_string(), body.to_string())
}

async fn socket_status(
    address: SocketAddr,
    configure: impl FnOnce(&mut axum::http::Request<()>),
) -> Result<(), StatusCode> {
    let mut request = format!("ws://{address}/ws").into_client_request().unwrap();
    configure(&mut request);
    match tokio_tungstenite::connect_async(request).await {
        Ok((mut socket, _)) => {
            socket.close(None).await.ok();
            Ok(())
        }
        Err(tokio_tungstenite::tungstenite::Error::Http(response)) => Err(response.status()),
        Err(error) => panic!("unexpected socket error: {error}"),
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_loopback_caller_needs_a_token_on_every_route() {
    let root = std::env::temp_dir().join(format!("perch-local-authority-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&root).unwrap();
    let db_path = root.join("history.sqlite");
    let db = Arc::new(HistoryDb::open(&db_path).unwrap());
    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
    let local_ui = crate::local_ui::LocalUi::in_process();
    let server = tokio::spawn(run(
        ServerOptions {
            port: 0,
            base_path: "/".into(),
            web_dist_dir: root.join("web"),
            db_path: Some(db_path),
            hosts_path: Some(root.join("hosts.json")),
            providers_path: None,
            devices_path: Some(root.join("devices.json")),
            ready_tx: Some(ready_tx),
            phone_access_port: None,
            local_ui: local_ui.clone(),
        },
        db.clone(),
        root.display().to_string(),
    ));
    let address = tokio::time::timeout(std::time::Duration::from_secs(5), ready_rx)
        .await
        .unwrap()
        .unwrap();
    let token = local_ui.token().to_string();
    let agent = db
        .issue(&AgentKey::new("nest", "alpha", "claude").unwrap())
        .unwrap();

    // Without a token: refused on the socket and on every data route.
    assert_eq!(
        socket_status(address, |_| {}).await,
        Err(StatusCode::UNAUTHORIZED)
    );
    for (method, path) in [
        ("POST", "/clipboard-image?ext=png"),
        ("POST", "/upload"),
        ("GET", "/workspace-file"),
    ] {
        assert_eq!(http(address, method, path, &[]).await.0, 401, "{path}");
    }
    let (_, _, body) = http(address, "GET", "/pair", &[]).await;
    assert!(body.contains("\"paired\":false"), "{body}");

    // The local UI token opens them, however it is presented.
    let bearer = format!("Bearer {token}");
    let cookie = format!("perch_local={token}");
    for headers in [
        vec![("Authorization", bearer.as_str())],
        vec![("Cookie", cookie.as_str())],
    ] {
        let (_, _, body) = http(address, "GET", "/pair", &headers).await;
        assert!(body.contains("\"paired\":true"), "{body}");
        // Past the gate: the routes' own refusals (not 401/403) answer.
        assert_eq!(
            http(address, "POST", "/clipboard-image?ext=png", &headers)
                .await
                .0,
            415
        );
        assert_eq!(http(address, "POST", "/upload", &headers).await.0, 400);
        assert_eq!(
            http(address, "GET", "/workspace-file", &headers).await.0,
            400
        );
    }
    let (_, _, body) = http(address, "GET", &format!("/pair?token={token}"), &[]).await;
    assert!(body.contains("\"paired\":true"));
    assert_eq!(
        socket_status(address, |request| {
            request
                .headers_mut()
                .insert("authorization", bearer.parse().unwrap());
        })
        .await,
        Ok(())
    );
    assert_eq!(
        socket_status(address, |request| {
            request
                .headers_mut()
                .insert("cookie", cookie.parse().unwrap());
        })
        .await,
        Ok(())
    );
    // A wrong token of the right length is no better than none.
    let wrong = format!("Bearer {}", "0".repeat(token.len()));
    assert_eq!(
        socket_status(address, |request| {
            request
                .headers_mut()
                .insert("authorization", wrong.parse().unwrap());
        })
        .await,
        Err(StatusCode::UNAUTHORIZED)
    );

    // Only from this machine: a proxy header, or a page from another origin, voids it.
    let proxied = [
        ("Authorization", bearer.as_str()),
        ("X-Forwarded-For", "203.0.113.9"),
    ];
    let (_, _, body) = http(address, "GET", "/pair", &proxied).await;
    assert!(body.contains("\"paired\":false"), "{body}");
    assert_eq!(
        socket_status(address, |request| {
            let headers = request.headers_mut();
            headers.insert("authorization", bearer.parse().unwrap());
            headers.insert("origin", "https://untrusted.example".parse().unwrap());
        })
        .await,
        Err(StatusCode::FORBIDDEN)
    );

    // The hub's own connection to a core (`hub::socket_request`): a remote core refuses a
    // hub that sends no credential, and admits one that sends the core's token as a header.
    let url = format!("ws://{address}/ws");
    let refused = tokio_tungstenite::connect_async(crate::hub::socket_request(&url, None).unwrap())
        .await
        .unwrap_err();
    let message = crate::hub::connect_failure(&refused);
    assert!(message.contains("refused this machine (401)"), "{message}");
    let (mut federated, _) =
        tokio_tungstenite::connect_async(crate::hub::socket_request(&url, Some(&token)).unwrap())
            .await
            .unwrap();
    federated.close(None).await.ok();
    // A `directUrl` the user gave a `?token=` also gets in, from this machine only.
    let (mut direct, _) = tokio_tungstenite::connect_async(
        crate::hub::socket_request(&format!("{url}?token={token}"), None).unwrap(),
    )
    .await
    .unwrap();
    direct.close(None).await.ok();

    // An agent's token opens only `/agent/*`, and the local UI token never does.
    let agent_bearer = format!("Bearer {}", agent.token);
    assert_eq!(
        socket_status(address, |request| {
            request
                .headers_mut()
                .insert("authorization", agent_bearer.parse().unwrap());
        })
        .await,
        Err(StatusCode::FORBIDDEN)
    );
    let body = serde_json::json!({ "session": "alpha" }).to_string();
    for headers in [vec![], vec![("Authorization", bearer.as_str())]] {
        assert_eq!(
            super::agent::tests::request(address, "POST", "/agent/whoami", &headers, &body)
                .await
                .0,
            401
        );
    }
    let own = [("Authorization", agent_bearer.as_str())];
    assert_eq!(
        super::agent::tests::request(address, "POST", "/agent/whoami", &own, &body)
            .await
            .0,
        200
    );

    server.abort();
    let _ = server.await;
    let _ = std::fs::remove_dir_all(root);
}

/// The webview's way in: a single-use code becomes the cookie, only from this machine.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_sign_in_code_buys_the_local_cookie_once() {
    let root = std::env::temp_dir().join(format!("perch-local-login-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&root).unwrap();
    let db_path = root.join("history.sqlite");
    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
    let local_ui = crate::local_ui::LocalUi::in_process();
    let server = tokio::spawn(run(
        ServerOptions {
            port: 0,
            base_path: "/".into(),
            web_dist_dir: root.join("web"),
            db_path: Some(db_path.clone()),
            hosts_path: Some(root.join("hosts.json")),
            providers_path: None,
            devices_path: Some(root.join("devices.json")),
            ready_tx: Some(ready_tx),
            phone_access_port: None,
            local_ui: local_ui.clone(),
        },
        Arc::new(HistoryDb::open(&db_path).unwrap()),
        root.display().to_string(),
    ));
    let address = tokio::time::timeout(std::time::Duration::from_secs(5), ready_rx)
        .await
        .unwrap()
        .unwrap();
    let code = local_ui.issue_login_code();

    assert_eq!(http(address, "GET", "/local-login", &[]).await.0, 403);
    assert_eq!(
        http(address, "GET", "/local-login?code=nope", &[]).await.0,
        403
    );
    // A proxied request is refused without spending the code.
    assert_eq!(
        http(
            address,
            "GET",
            &format!("/local-login?code={code}"),
            &[("X-Forwarded-For", "203.0.113.9")]
        )
        .await
        .0,
        403
    );
    let (status, head, _) = http(address, "GET", &format!("/local-login?code={code}"), &[]).await;
    assert_eq!(status, 303, "{head}");
    let lower = head.to_ascii_lowercase();
    assert!(lower.contains("location: ./"), "{head}");
    assert!(
        head.contains(&format!(
            "perch_local={}; Path=/; HttpOnly; SameSite=Strict",
            local_ui.token()
        )),
        "the cookie carries the token, HttpOnly"
    );
    assert!(!head.contains(&code), "the one-use code is not echoed back");
    assert_eq!(
        http(address, "GET", &format!("/local-login?code={code}"), &[])
            .await
            .0,
        403,
        "a spent code is gone"
    );
    let cookie = format!("perch_local={}", local_ui.token());
    let (_, _, body) = http(address, "GET", "/pair", &[("Cookie", cookie.as_str())]).await;
    assert!(body.contains("\"paired\":true"), "{body}");

    server.abort();
    let _ = server.await;
    let _ = std::fs::remove_dir_all(root);
}
