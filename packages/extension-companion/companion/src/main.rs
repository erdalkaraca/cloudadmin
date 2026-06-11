use anyhow::{Context, Result};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    net::{SocketAddr, TcpListener},
    path::PathBuf,
    process::Stdio,
    sync::Arc,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    process::Command,
    sync::Mutex,
};

#[derive(Clone)]
struct AppState {
    sessions: Arc<Mutex<HashMap<String, ProxySession>>>,
    kubectl_bin_override: Option<String>,
    allowed_origins: Vec<String>,
    tool_policies: Arc<Mutex<HashMap<String, Vec<ToolPolicyRule>>>>,
}

struct ProxySession {
    port: u16,
    child: tokio::process::Child,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct K8sProxyRequest {
    requester: Option<String>,
    kubeconfig_path: Option<String>,
    context: Option<String>,
    method: String,
    path: String,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct K8sProxyResponse {
    status: u16,
    content_type: Option<String>,
    body: String,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    ok: bool,
    version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct KubectlLatestResponse {
    ok: bool,
    version: String,
    url: String,
    path: String,
    sha256: String,
    downloaded: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolPolicyRuleRequest {
    tool: String,
    allowed_args_prefixes: Vec<Vec<String>>,
}

#[derive(Debug, Clone)]
struct ToolPolicyRule {
    tool: String,
    allowed_args_prefixes: Vec<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterToolPoliciesRequest {
    requester: String,
    rules: Vec<ToolPolicyRuleRequest>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RegisterToolPoliciesResponse {
    ok: bool,
    requester: String,
    rules_count: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolExecRequest {
    requester: String,
    tool: String,
    args: Vec<String>,
    env: Option<HashMap<String, String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolExecResponse {
    exit_code: i32,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolInstallRequest {
    requester: String,
    tool: String,
    version: String,
    os: Option<String>,
    arch: Option<String>,
    force: Option<bool>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct K8sExecRequest {
    requester: Option<String>,
    kubeconfig_path: Option<String>,
    context: String,
    namespace: String,
    pod: String,
    container: String,
    command: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TerminalResizeEnvelope {
    resize: Option<TerminalResize>,
}

#[derive(Debug, Deserialize)]
struct TerminalResize {
    cols: u16,
    rows: u16,
}

fn log_info(message: &str) {
    eprintln!("[cloudadmin-companion] {message}");
}

fn request_origin(headers: &HeaderMap) -> &str {
    headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .unwrap_or("<none>")
}

#[tokio::main]
async fn main() -> Result<()> {
    let listen = std::env::var("CLOUDADMIN_COMPANION_LISTEN")
        .unwrap_or_else(|_| "127.0.0.1:9477".to_string());
    let kubectl_bin_override = std::env::var("CLOUDADMIN_KUBECTL_BIN")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let allowed_origins = std::env::var("CLOUDADMIN_ALLOWED_ORIGINS")
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();

    if allowed_origins.is_empty() {
        log_info(&format!(
            "starting v{} listen={} kubectl={} allowed_origins=<defaults>",
            env!("CARGO_PKG_VERSION"),
            listen,
            kubectl_bin_override.as_deref().unwrap_or("<managed>")
        ));
    } else {
        log_info(&format!(
            "starting v{} listen={} kubectl={} allowed_origins={}",
            env!("CARGO_PKG_VERSION"),
            listen,
            kubectl_bin_override.as_deref().unwrap_or("<managed>"),
            allowed_origins.join(",")
        ));
    }

    let state = AppState {
        sessions: Arc::new(Mutex::new(HashMap::new())),
        kubectl_bin_override,
        allowed_origins,
        tool_policies: Arc::new(Mutex::new(HashMap::new())),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/tools/policies/register", post(register_tool_policies).options(preflight))
        .route("/tools/exec", post(execute_tool).options(preflight))
        .route("/tools/install", post(install_tool).options(preflight))
        .route("/k8s/proxy", post(proxy_kubernetes).options(preflight))
        .route("/k8s/exec", get(exec_kubernetes))
        .with_state(state);

    let addr: SocketAddr = listen
        .parse()
        .context("invalid CLOUDADMIN_COMPANION_LISTEN")?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    log_info(&format!("webserver listening on http://{addr}"));
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let origin = request_origin(&headers).to_string();
    log_info(&format!("GET /health origin={origin}"));
    if !is_allowed_origin(&state, &headers) {
        log_info(&format!("forbidden origin on /health origin={origin}"));
        return StatusCode::FORBIDDEN.into_response();
    }
    let mut response = Json(HealthResponse {
        ok: true,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
    .into_response();
    append_cors_headers(response.headers_mut(), &headers);
    response
}

async fn preflight(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let origin = request_origin(&headers).to_string();
    log_info(&format!("OPTIONS /k8s/proxy origin={origin}"));
    if !is_allowed_origin(&state, &headers) {
        log_info(&format!("forbidden origin on OPTIONS /k8s/proxy origin={origin}"));
        return StatusCode::FORBIDDEN.into_response();
    }
    let mut response = StatusCode::NO_CONTENT.into_response();
    append_cors_headers(response.headers_mut(), &headers);
    response
}

async fn proxy_kubernetes(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<K8sProxyRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let origin = request_origin(&headers).to_string();
    log_info(&format!(
        "POST /k8s/proxy origin={} method={} path={} context={}",
        origin,
        request.method,
        request.path,
        request.context.as_deref().unwrap_or("")
    ));
    if !is_allowed_origin(&state, &headers) {
        log_info(&format!("forbidden origin on POST /k8s/proxy origin={origin}"));
        return Err(StatusCode::FORBIDDEN);
    }

    let requester = request
        .requester
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("extension-k8s");
    ensure_tool_request_allowed(&state, requester, "kubectl", &["proxy"]) 
        .await
        .map_err(|error| {
            log_info(&format!("k8s proxy policy denied: {error}"));
            StatusCode::FORBIDDEN
        })?;

    let proxied = proxy_request(&state, request)
        .await
        .map_err(|error| {
            log_info(&format!("proxy request failed: {error}"));
            StatusCode::BAD_GATEWAY
        })?;

    let mut response = (
        StatusCode::from_u16(proxied.status).map_err(|_| StatusCode::BAD_GATEWAY)?,
        proxied.body,
    )
        .into_response();

    if let Some(content_type) = proxied.content_type {
        if let Ok(value) = HeaderValue::from_str(&content_type) {
            response.headers_mut().insert(header::CONTENT_TYPE, value);
        }
    }
    append_cors_headers(response.headers_mut(), &headers);
    Ok(response)
}

async fn exec_kubernetes(
    State(state): State<AppState>,
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    Query(request): Query<K8sExecRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let origin = request_origin(&headers).to_string();
    log_info(&format!(
        "GET /k8s/exec origin={} context={} namespace={} pod={} container={}",
        origin, request.context, request.namespace, request.pod, request.container,
    ));
    if !is_allowed_origin(&state, &headers) {
        log_info(&format!("forbidden origin on GET /k8s/exec origin={origin}"));
        return Err(StatusCode::FORBIDDEN);
    }

    let requester = request
        .requester
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("extension-k8s")
        .to_string();

    validate_exec_request(&request).map_err(|error| {
        log_info(&format!("invalid k8s exec request: {error}"));
        StatusCode::BAD_REQUEST
    })?;

    let command = parse_exec_command(request.command.as_deref()).map_err(|error| {
        log_info(&format!("invalid k8s exec command: {error}"));
        StatusCode::BAD_REQUEST
    })?;
    let args = build_kubectl_exec_args(&request, &command);
    let arg_refs = args.iter().map(String::as_str).collect::<Vec<_>>();

    ensure_tool_request_allowed(&state, &requester, "kubectl", &arg_refs)
        .await
        .map_err(|error| {
            log_info(&format!("k8s exec policy denied: {error}"));
            StatusCode::FORBIDDEN
        })?;

    let kubectl_bin = ensure_kubectl_available(&state).await.map_err(|error| {
        log_info(&format!("failed to ensure kubectl for k8s exec: {error}"));
        StatusCode::BAD_GATEWAY
    })?;

    let mut response = ws.on_upgrade(move |socket| async move {
        if let Err(error) = handle_exec_socket(socket, kubectl_bin, request, command).await {
            log_info(&format!("k8s exec session failed: {error}"));
        }
    }).into_response();
    append_cors_headers(response.headers_mut(), &headers);
    Ok(response)
}

async fn register_tool_policies(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<RegisterToolPoliciesRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let origin = request_origin(&headers).to_string();
    log_info(&format!("POST /tools/policies/register origin={origin}"));
    if !is_allowed_origin(&state, &headers) {
        return Err(StatusCode::FORBIDDEN);
    }

    let requester = request.requester.trim().to_string();
    if requester.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let rules = request
        .rules
        .into_iter()
        .map(|rule| ToolPolicyRule {
            tool: rule.tool.trim().to_string(),
            allowed_args_prefixes: rule
                .allowed_args_prefixes
                .into_iter()
                .map(|prefix| {
                    prefix
                        .into_iter()
                        .map(|item| item.trim().to_string())
                        .filter(|item| !item.is_empty())
                        .collect::<Vec<_>>()
                })
                .filter(|prefix| !prefix.is_empty())
                .collect::<Vec<_>>(),
        })
        .filter(|rule| !rule.tool.is_empty())
        .collect::<Vec<_>>();

    if rules.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    {
        let mut policies = state.tool_policies.lock().await;
        policies.insert(requester.clone(), rules.clone());
    }

    log_info(&format!(
        "registered tool policies requester={} rules={}",
        requester,
        rules.len()
    ));

    let mut response = Json(RegisterToolPoliciesResponse {
        ok: true,
        requester,
        rules_count: rules.len(),
    })
    .into_response();
    append_cors_headers(response.headers_mut(), &headers);
    Ok(response)
}

async fn execute_tool(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<ToolExecRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let origin = request_origin(&headers).to_string();
    log_info(&format!("POST /tools/exec origin={origin}"));
    if !is_allowed_origin(&state, &headers) {
        return Err(StatusCode::FORBIDDEN);
    }

    let requester = request.requester.trim();
    let tool = request.tool.trim();
    if requester.is_empty() || tool.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let args = request.args.iter().map(String::as_str).collect::<Vec<_>>();
    ensure_tool_request_allowed(&state, requester, tool, &args)
        .await
        .map_err(|error| {
            log_info(&format!("tool exec denied: {error}"));
            StatusCode::FORBIDDEN
        })?;

    let resolved_tool = if tool == "kubectl" {
        ensure_kubectl_available(&state).await.map_err(|error| {
            log_info(&format!("failed to ensure kubectl for tool exec: {error}"));
            StatusCode::BAD_GATEWAY
        })?
    } else {
        tool.to_string()
    };

    let mut command = Command::new(&resolved_tool);
    command.args(request.args.iter().map(String::as_str));
    if let Some(env_map) = request.env {
        for (key, value) in env_map {
            if !key.trim().is_empty() {
                command.env(key, value);
            }
        }
    }

    let output = command.output().await.map_err(|error| {
        log_info(&format!("tool exec failed to start: {error}"));
        StatusCode::BAD_GATEWAY
    })?;

    let mut response = Json(ToolExecResponse {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
    .into_response();
    append_cors_headers(response.headers_mut(), &headers);
    Ok(response)
}

async fn install_tool(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<ToolInstallRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let origin = request_origin(&headers).to_string();
    log_info(&format!("POST /tools/install origin={origin}"));
    if !is_allowed_origin(&state, &headers) {
        return Err(StatusCode::FORBIDDEN);
    }

    let requester = request.requester.trim();
    let tool = request.tool.trim();
    if requester.is_empty() || tool.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    ensure_tool_request_allowed(&state, requester, tool, &["install", request.version.as_str()])
        .await
        .map_err(|error| {
            log_info(&format!("tool install denied: {error}"));
            StatusCode::FORBIDDEN
        })?;

    if tool != "kubectl" {
        return Err(StatusCode::BAD_REQUEST);
    }

    let os = normalize_kubectl_os(request.os.as_deref())
        .map_err(|_| StatusCode::BAD_REQUEST)?
        .to_string();
    let arch = normalize_kubectl_arch(request.arch.as_deref())
        .map_err(|_| StatusCode::BAD_REQUEST)?
        .to_string();
    let force = request.force.unwrap_or(false);

    let response = install_kubectl_version(&request.version, &os, &arch, force)
        .await
        .map_err(|error| {
            log_info(&format!("tool install failed: {error}"));
            StatusCode::BAD_GATEWAY
        })?;

    let mut http_response = Json(response).into_response();
    append_cors_headers(http_response.headers_mut(), &headers);
    Ok(http_response)
}

fn validate_exec_request(request: &K8sExecRequest) -> Result<()> {
    if request.context.trim().is_empty()
        || request.namespace.trim().is_empty()
        || request.pod.trim().is_empty()
        || request.container.trim().is_empty()
    {
        anyhow::bail!("context, namespace, pod, and container are required");
    }
    Ok(())
}

fn parse_exec_command(raw: Option<&str>) -> Result<Vec<String>> {
    let Some(raw) = raw.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(vec!["/bin/sh".to_string()]);
    };

    let parsed = serde_json::from_str::<Vec<String>>(raw).context("command must be a JSON string array")?;
    let command = parsed
        .into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();

    if command.is_empty() {
        anyhow::bail!("command must not be empty");
    }

    Ok(command)
}

fn build_kubectl_exec_args(request: &K8sExecRequest, command: &[String]) -> Vec<String> {
    let mut args = vec![
        "exec".to_string(),
        "-i".to_string(),
        request.pod.trim().to_string(),
        "-n".to_string(),
        request.namespace.trim().to_string(),
        "--context".to_string(),
        request.context.trim().to_string(),
        "-c".to_string(),
        request.container.trim().to_string(),
        "--".to_string(),
    ];
    args.extend(command.iter().cloned());
    args
}

async fn handle_exec_socket(
    mut socket: WebSocket,
    kubectl_bin: String,
    request: K8sExecRequest,
    command: Vec<String>,
) -> Result<()> {
    let args = build_kubectl_exec_args(&request, &command);
    let mut child = Command::new(&kubectl_bin);
    child
        .args(args.iter().map(String::as_str))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(path) = request
        .kubeconfig_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        child.arg(format!("--kubeconfig={path}"));
    }

    let mut child = child
        .spawn()
        .with_context(|| format!("failed to spawn {} exec", kubectl_bin))?;

    let mut stdin = child.stdin.take().context("kubectl exec stdin missing")?;
    let mut stdout = child.stdout.take().context("kubectl exec stdout missing")?;
    let mut stderr = child.stderr.take().context("kubectl exec stderr missing")?;
    let mut stdout_open = true;
    let mut stderr_open = true;
    let mut stdout_buf = [0u8; 8192];
    let mut stderr_buf = [0u8; 8192];

    loop {
        tokio::select! {
            message = socket.recv() => {
                match message {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(envelope) = serde_json::from_str::<TerminalResizeEnvelope>(&text) {
                            if let Some(size) = envelope.resize {
                                log_info(&format!(
                                    "ignoring terminal resize cols={} rows={} (pty not yet enabled)",
                                    size.cols,
                                    size.rows
                                ));
                                continue;
                            }
                        }
                        stdin.write_all(text.as_bytes()).await?;
                        stdin.flush().await?;
                    }
                    Some(Ok(Message::Binary(data))) => {
                        stdin.write_all(&data).await?;
                        stdin.flush().await?;
                    }
                    Some(Ok(Message::Ping(data))) => {
                        socket.send(Message::Pong(data)).await?;
                    }
                    Some(Ok(Message::Pong(_))) => {}
                    Some(Ok(Message::Close(_))) | None => {
                        break;
                    }
                    Some(Err(error)) => {
                        anyhow::bail!("websocket receive failed: {error}");
                    }
                }
            }
            read = stdout.read(&mut stdout_buf), if stdout_open => {
                let bytes_read = read.context("failed to read kubectl exec stdout")?;
                if bytes_read == 0 {
                    stdout_open = false;
                } else {
                    socket.send(Message::Binary(stdout_buf[..bytes_read].to_vec())).await
                        .context("failed to forward stdout to websocket")?;
                }
            }
            read = stderr.read(&mut stderr_buf), if stderr_open => {
                let bytes_read = read.context("failed to read kubectl exec stderr")?;
                if bytes_read == 0 {
                    stderr_open = false;
                } else {
                    socket.send(Message::Binary(stderr_buf[..bytes_read].to_vec())).await
                        .context("failed to forward stderr to websocket")?;
                }
            }
        }

        if !stdout_open && !stderr_open {
            break;
        }
    }

    drop(stdin);

    let status = match child.try_wait().context("failed to poll kubectl exec")? {
        Some(status) => status,
        None => {
            let _ = child.kill().await;
            child.wait().await.context("failed to wait for kubectl exec after kill")?
        }
    };

    log_info(&format!("kubectl exec finished status={status}"));
    let _ = socket.close().await;
    Ok(())
}

async fn ensure_kubectl_available(state: &AppState) -> Result<String> {
    if let Some(path) = &state.kubectl_bin_override {
        return Ok(path.clone());
    }

    let tools_dir = companion_tools_dir()?;
    let binary_path = tools_dir.join(kubectl_binary_name(normalize_kubectl_os(None)?));

    if !binary_path.exists() {
        anyhow::bail!(
            "managed kubectl is missing at {} (install via /tools/install)",
            binary_path.display()
        );
    }

    Ok(binary_path.to_string_lossy().to_string())
}

async fn install_kubectl_version(
    version: &str,
    os: &str,
    arch: &str,
    force_download: bool,
) -> Result<KubectlLatestResponse> {

    let binary_name = kubectl_binary_name(os);
    let binary_url = format!("https://dl.k8s.io/release/{version}/bin/{os}/{arch}/{binary_name}");
    let checksum_url = format!("{binary_url}.sha256");

    let tools_dir = companion_tools_dir()?;
    let binary_path = tools_dir.join(binary_name);
    let version_path = tools_dir.join(format!("kubectl-{os}-{arch}.version"));

    if !force_download
        && binary_path.exists()
        && fs::read_to_string(&version_path)
            .map(|current| current.trim().to_string())
            .ok()
            .as_deref()
            == Some(version)
    {
        log_info(&format!(
            "kubectl already installed version={} path={}",
            version,
            binary_path.display()
        ));
        return Ok(KubectlLatestResponse {
            ok: true,
            version: version.to_string(),
            url: binary_url,
            path: binary_path.to_string_lossy().to_string(),
            sha256: String::new(),
            downloaded: false,
        });
    }

    let bytes = fetch_bytes(&binary_url).await?;
    let expected_sha = fetch_text(&checksum_url).await?;
    let actual_sha = sha256_hex(&bytes);
    if actual_sha != expected_sha {
        anyhow::bail!(
            "kubectl checksum mismatch expected={} actual={}",
            expected_sha,
            actual_sha
        );
    }

    write_file_atomic(&binary_path, &bytes)?;
    fs::write(&version_path, format!("{version}\n"))?;

    log_info(&format!(
        "installed kubectl version={} os={} arch={} path={}",
        version,
        os,
        arch,
        binary_path.display()
    ));

    Ok(KubectlLatestResponse {
        ok: true,
        version: version.to_string(),
        url: binary_url,
        path: binary_path.to_string_lossy().to_string(),
        sha256: actual_sha,
        downloaded: true,
    })
}

async fn ensure_tool_request_allowed(
    state: &AppState,
    requester: &str,
    tool: &str,
    args: &[&str],
) -> Result<()> {
    let policies = state.tool_policies.lock().await;
    let rules = policies
        .get(requester)
        .with_context(|| format!("no tool policy registered for requester {requester}"))?;

    let allowed = rules.iter().any(|rule| {
        if rule.tool != tool {
            return false;
        }
        if rule.allowed_args_prefixes.is_empty() {
            return true;
        }
        rule.allowed_args_prefixes.iter().any(|prefix| {
            args.len() >= prefix.len()
                && prefix
                    .iter()
                    .zip(args.iter())
                    .all(|(left, right)| left == right)
        })
    });

    if !allowed {
        anyhow::bail!(
            "requester {} is not allowed to run {} {}",
            requester,
            tool,
            args.join(" ")
        );
    }

    Ok(())
}

fn is_allowed_origin(state: &AppState, headers: &HeaderMap) -> bool {
    let Some(origin) = headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
    else {
        return true;
    };

    if state.allowed_origins.iter().any(|allowed| allowed == origin) {
        return true;
    }

    origin.starts_with("http://localhost:")
        || origin.starts_with("https://localhost:")
        || origin.starts_with("http://127.0.0.1:")
        || origin.starts_with("https://127.0.0.1:")
        || origin.starts_with("vscode-webview://")
        || origin == "null"
}

fn append_cors_headers(target: &mut HeaderMap, source: &HeaderMap) {
    if let Some(origin) = source.get(header::ORIGIN) {
        target.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin.clone());
    }
    target.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, OPTIONS"),
    );
    target.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("content-type, authorization"),
    );
    target.insert(header::VARY, HeaderValue::from_static("Origin"));
}

fn normalize_kubectl_os(value: Option<&str>) -> Result<&'static str> {
    let raw = value.unwrap_or(std::env::consts::OS).trim().to_ascii_lowercase();
    match raw.as_str() {
        "linux" => Ok("linux"),
        "windows" | "win32" => Ok("windows"),
        "darwin" | "macos" | "osx" => Ok("darwin"),
        _ => anyhow::bail!("unsupported os: {raw}"),
    }
}

fn normalize_kubectl_arch(value: Option<&str>) -> Result<&'static str> {
    let raw = value
        .unwrap_or(std::env::consts::ARCH)
        .trim()
        .to_ascii_lowercase();
    match raw.as_str() {
        "x86_64" | "amd64" => Ok("amd64"),
        "aarch64" | "arm64" => Ok("arm64"),
        _ => anyhow::bail!("unsupported arch: {raw}"),
    }
}

fn kubectl_binary_name(os: &str) -> &'static str {
    if os == "windows" {
        "kubectl.exe"
    } else {
        "kubectl"
    }
}

fn companion_tools_dir() -> Result<PathBuf> {
    let exe = std::env::current_exe().context("failed to locate current executable")?;
    exe.parent()
        .map(PathBuf::from)
        .context("failed to resolve executable parent directory")
}

async fn fetch_text(url: &str) -> Result<String> {
    let response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .with_context(|| format!("request failed for {url}"))?;
    let status = response.status();
    if !status.is_success() {
        anyhow::bail!("request failed for {url}: {status}");
    }
    Ok(response
        .text()
        .await
        .with_context(|| format!("failed to read response body for {url}"))?
        .trim()
        .to_string())
}

async fn fetch_bytes(url: &str) -> Result<Vec<u8>> {
    let response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .with_context(|| format!("request failed for {url}"))?;
    let status = response.status();
    if !status.is_success() {
        anyhow::bail!("request failed for {url}: {status}");
    }
    Ok(response
        .bytes()
        .await
        .with_context(|| format!("failed to read response body for {url}"))?
        .to_vec())
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn write_file_atomic(path: &PathBuf, bytes: &[u8]) -> Result<()> {
    let tmp_path = path.with_extension("new");
    fs::write(&tmp_path, bytes)
        .with_context(|| format!("failed to write temporary file {}", tmp_path.display()))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&tmp_path)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&tmp_path, perms)?;
    }

    fs::rename(&tmp_path, path).with_context(|| {
        format!(
            "failed to move temporary file {} to {}",
            tmp_path.display(),
            path.display()
        )
    })?;
    Ok(())
}

async fn proxy_request(state: &AppState, request: K8sProxyRequest) -> Result<K8sProxyResponse> {
    let session = ensure_session(
        state,
        request.kubeconfig_path.as_deref(),
        request.context.as_deref(),
    )
    .await?;
    let url = format!("http://127.0.0.1:{}{}", session.port, request.path);

    let method = Method::from_bytes(request.method.as_bytes()).context("invalid HTTP method")?;
    let client = reqwest::Client::new();
    let mut builder = client.request(method, url);

    for (key, value) in request.headers.unwrap_or_default() {
        let lower = key.to_ascii_lowercase();
        if lower == "origin" || lower == "host" || lower == "content-length" {
            continue;
        }
        builder = builder.header(key, value);
    }

    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let response = builder.send().await.context("failed to reach kubectl proxy")?;
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let body = response.text().await.context("failed to read proxied response")?;

    Ok(K8sProxyResponse {
        status,
        content_type,
        body,
    })
}

async fn ensure_session(
    state: &AppState,
    kubeconfig_path: Option<&str>,
    context: Option<&str>,
) -> Result<SessionHandle> {
    let kubeconfig_key = kubeconfig_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("<default>");
    let key = format!("{}::{}", kubeconfig_key, context.unwrap_or_default().trim());
    let mut sessions = state.sessions.lock().await;

    if let Some(existing) = sessions.get_mut(&key) {
        if existing.child.try_wait()?.is_none() {
            log_info(&format!("reusing kubectl proxy session port={}", existing.port));
            return Ok(SessionHandle { port: existing.port });
        }
    }

    let session = spawn_proxy(state, kubeconfig_path, context).await?;
    let port = session.port;
    sessions.insert(key, session);
    Ok(SessionHandle { port })
}

async fn spawn_proxy(
    state: &AppState,
    kubeconfig_path: Option<&str>,
    context: Option<&str>,
) -> Result<ProxySession> {
    let port = allocate_port()?;
    let kubectl_bin = ensure_kubectl_available(state).await?;
    log_info(&format!("spawning kubectl proxy on port={port}"));
    let mut command = Command::new(&kubectl_bin);
    command
        .arg("proxy")
        .arg("--address=127.0.0.1")
        .arg(format!("--port={port}"))
        .arg("--accept-hosts=.*")
        .arg("--accept-paths=.*")
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    if let Some(path) = kubeconfig_path.map(str::trim).filter(|value| !value.is_empty()) {
        command.arg(format!("--kubeconfig={path}"));
    }

    if let Some(ctx) = context.map(str::trim) {
        if !ctx.is_empty() {
            command.arg(format!("--context={ctx}"));
        }
    }

    let child = command
        .spawn()
        .with_context(|| format!("failed to spawn {} proxy", kubectl_bin))?;

    wait_for_proxy(port).await?;
    log_info(&format!("kubectl proxy ready on port={port}"));

    Ok(ProxySession { port, child })
}

async fn wait_for_proxy(port: u16) -> Result<()> {
    let client = reqwest::Client::new();
    let url = format!("http://127.0.0.1:{port}/");
    for _ in 0..50 {
        if client.get(&url).send().await.is_ok() {
            return Ok(());
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    anyhow::bail!("kubectl proxy did not become ready")
}

fn allocate_port() -> Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

struct SessionHandle {
    port: u16,
}
