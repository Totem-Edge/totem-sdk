use opcua::client::prelude::*;
use opcua::sync::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, oneshot};

static SUB_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_sub_id() -> String {
    let id = SUB_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("sub_{:x}", id)
}

struct Config {
    listen_addr: String,
}

impl Config {
    fn from_env() -> Self {
        Self {
            listen_addr: std::env::var("OPCUA_LISTEN_ADDR")
                .unwrap_or_else(|_| "127.0.0.1:15006".into()),
        }
    }
}

#[derive(Deserialize)]
struct Request {
    id: String,
    #[serde(rename = "type")]
    req_type: String,
    #[serde(default)]
    endpoint_url: Option<String>,
    #[serde(default)]
    node_id: Option<String>,
    #[serde(default)]
    node_ids: Option<Vec<String>>,
    #[serde(default)]
    value: Option<OpcuaValueData>,
    #[serde(default)]
    args: Option<Vec<OpcuaValueData>>,
    #[serde(default)]
    object_id: Option<String>,
    #[serde(default)]
    method_id: Option<String>,
    #[serde(default)]
    sampling_interval: Option<f64>,
    #[serde(default)]
    subscription_id: Option<String>,
}

#[derive(Serialize)]
struct Response {
    id: String,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize, Clone)]
struct PushMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    subscription_id: Option<String>,
    node_id: String,
    value: OpcuaValueData,
}

#[derive(Serialize, Deserialize, Clone)]
struct OpcuaNodeData {
    node_id: String,
    browse_name: String,
    display_name: String,
    node_class: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    value_rank: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<OpcuaNodeData>>,
}

#[derive(Serialize, Deserialize, Clone)]
struct OpcuaValueData {
    value: serde_json::Value,
    data_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_timestamp: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    server_timestamp: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status_code: Option<u32>,
}

enum OpcuaCommand {
    Connect {
        endpoint_url: String,
        tx: oneshot::Sender<Result<(), String>>,
    },
    Disconnect {
        tx: oneshot::Sender<Result<(), String>>,
    },
    Browse {
        node_id: String,
        tx: oneshot::Sender<Result<Vec<OpcuaNodeData>, String>>,
    },
    Read {
        node_id: String,
        tx: oneshot::Sender<Result<OpcuaValueData, String>>,
    },
    Write {
        node_id: String,
        value: OpcuaValueData,
        tx: oneshot::Sender<Result<(), String>>,
    },
    Subscribe {
        node_ids: Vec<String>,
        interval: f64,
        tx: oneshot::Sender<Result<String, String>>,
    },
    Unsubscribe {
        subscription_id: String,
        tx: oneshot::Sender<Result<(), String>>,
    },
    Call {
        object_id: String,
        method_id: String,
        args: Vec<OpcuaValueData>,
        tx: oneshot::Sender<Result<Vec<OpcuaValueData>, String>>,
    },
}

fn variant_to_json(variant: &Variant) -> serde_json::Value {
    match variant {
        Variant::Boolean(v) => serde_json::Value::Bool(*v),
        Variant::SByte(v) => serde_json::json!(*v),
        Variant::Byte(v) => serde_json::json!(*v),
        Variant::Int16(v) => serde_json::json!(*v),
        Variant::UInt16(v) => serde_json::json!(*v),
        Variant::Int32(v) => serde_json::json!(*v),
        Variant::UInt32(v) => serde_json::json!(*v),
        Variant::Int64(v) => serde_json::json!(*v),
        Variant::UInt64(v) => serde_json::json!(*v),
        Variant::Float(v) => serde_json::json!(*v),
        Variant::Double(v) => serde_json::json!(*v),
        Variant::String(v) => serde_json::Value::String(v.as_ref().to_string()),
        Variant::ByteString(v) => serde_json::Value::String(hex::encode(v.as_ref())),
        Variant::DateTime(v) => serde_json::json!(v.ticks()),
        Variant::Guid(v) => serde_json::Value::String(v.to_string()),
        Variant::StatusCode(v) => serde_json::json!(v.bits()),
        Variant::Array(v) => {
            let arr: Vec<serde_json::Value> = v.values.iter().map(|val| variant_to_json(val)).collect();
            serde_json::Value::Array(arr)
        }
        _ => serde_json::Value::Null,
    }
}

fn variant_type_name(variant: &Variant) -> &'static str {
    match variant {
        Variant::Empty => "Null",
        Variant::Boolean(_) => "Boolean",
        Variant::SByte(_) => "SByte",
        Variant::Byte(_) => "Byte",
        Variant::Int16(_) => "Int16",
        Variant::UInt16(_) => "UInt16",
        Variant::Int32(_) => "Int32",
        Variant::UInt32(_) => "UInt32",
        Variant::Int64(_) => "Int64",
        Variant::UInt64(_) => "UInt64",
        Variant::Float(_) => "Float",
        Variant::Double(_) => "Double",
        Variant::String(_) => "String",
        Variant::ByteString(_) => "ByteString",
        Variant::DateTime(_) => "DateTime",
        Variant::Guid(_) => "Guid",
        Variant::StatusCode(_) => "StatusCode",
        Variant::Array(_) => "Array",
        _ => "Unknown",
    }
}

fn json_to_variant(value: &serde_json::Value, data_type: &str) -> Result<Variant, String> {
    match data_type {
        "Boolean" => Ok(Variant::Boolean(value.as_bool().unwrap_or(false))),
        "SByte" => Ok(Variant::SByte(value.as_i64().unwrap_or(0) as i8)),
        "Byte" => Ok(Variant::Byte(value.as_u64().unwrap_or(0) as u8)),
        "Int16" => Ok(Variant::Int16(value.as_i64().unwrap_or(0) as i16)),
        "UInt16" => Ok(Variant::UInt16(value.as_u64().unwrap_or(0) as u16)),
        "Int32" => Ok(Variant::Int32(value.as_i64().unwrap_or(0) as i32)),
        "UInt32" => Ok(Variant::UInt32(value.as_u64().unwrap_or(0) as u32)),
        "Int64" => Ok(Variant::Int64(value.as_i64().unwrap_or(0))),
        "UInt64" => Ok(Variant::UInt64(value.as_u64().unwrap_or(0))),
        "Float" => Ok(Variant::Float(value.as_f64().unwrap_or(0.0) as f32)),
        "Double" => Ok(Variant::Double(value.as_f64().unwrap_or(0.0))),
        "String" => Ok(Variant::String(
            UAString::from(value.as_str().unwrap_or("").to_string()),
        )),
        "ByteString" => {
            let hex_str = value.as_str().unwrap_or("");
            let bytes =
                hex::decode(hex_str).map_err(|e| format!("invalid hex byte string: {}", e))?;
            Ok(Variant::ByteString(ByteString::from(bytes)))
        }
        "DateTime" => {
            let ts = value.as_i64().unwrap_or(0);
            Ok(Variant::DateTime(Box::new(DateTime::from(ts))))
        }
        _ => Err(format!("unsupported data type: {}", data_type)),
    }
}

fn node_id_from_string(s: &str) -> Result<NodeId, String> {
    s.parse::<NodeId>()
        .map_err(|_| format!("invalid node id: {}", s))
}

fn node_id_to_string(node_id: &NodeId) -> String {
    node_id.to_string()
}

fn expanded_node_id_to_string(node_id: &ExpandedNodeId) -> String {
    node_id.to_string()
}

fn data_value_to_opcua_value(dv: &DataValue) -> OpcuaValueData {
    let (value, data_type) = if let Some(ref variant) = dv.value {
        (variant_to_json(variant), variant_type_name(variant).to_string())
    } else {
        (serde_json::Value::Null, "Null".to_string())
    };

    OpcuaValueData {
        value,
        data_type,
        source_timestamp: dv.source_timestamp.as_ref().map(|dt| dt.ticks()),
        server_timestamp: dv.server_timestamp.as_ref().map(|dt| dt.ticks()),
        status_code: dv.status.as_ref().map(|sc| sc.bits()),
    }
}

fn reference_to_node_data(r: &ReferenceDescription) -> OpcuaNodeData {
    OpcuaNodeData {
        node_id: expanded_node_id_to_string(&r.node_id),
        browse_name: format!("{}:{}", r.browse_name.namespace_index, r.browse_name.name),
        display_name: r.display_name.text.to_string(),
        node_class: format!("{:?}", r.node_class),
        data_type: None,
        value_rank: None,
        children: None,
    }
}

struct OpcuaState {
    client: Option<Client>,
    session: Option<Arc<RwLock<Session>>>,
    subscriptions: HashMap<String, u32>,
    push_tx: broadcast::Sender<String>,
}

impl OpcuaState {
    fn new(push_tx: broadcast::Sender<String>) -> Self {
        Self {
            client: None,
            session: None,
            subscriptions: HashMap::new(),
            push_tx,
        }
    }

    fn connect(&mut self, endpoint_url: &str) -> Result<(), String> {
        let mut client = ClientBuilder::new()
            .application_name("totem-edge-opcua")
            .application_uri("urn:totem:edge:opcua")
            .create_sample_keypair(true)
            .client()
            .ok_or_else(|| "create client failed".to_string())?;

        let endpoint: EndpointDescription = (
            endpoint_url,
            "None",
            MessageSecurityMode::None,
            UserTokenPolicy::anonymous(),
        )
            .into();

        let session = client
            .connect_to_endpoint(endpoint, IdentityToken::Anonymous)
            .map_err(|e| format!("connect failed: {:?}", e))?;

        {
            let mut session = session.write();
            session
                .connect_and_activate()
                .map_err(|e| format!("activate session failed: {:?}", e))?;
        }

        self.client = Some(client);
        self.session = Some(session);
        Ok(())
    }

    fn disconnect(&mut self) -> Result<(), String> {
        self.subscriptions.clear();
        if let Some(ref session) = self.session {
            session.write().disconnect();
        }
        self.session = None;
        self.client = None;
        Ok(())
    }

    fn get_session(&self) -> Result<Arc<RwLock<Session>>, String> {
        self.session
            .clone()
            .ok_or_else(|| "not connected".to_string())
    }

    fn browse(&self, node_id: &str) -> Result<Vec<OpcuaNodeData>, String> {
        let session = self.get_session()?;
        let nid = node_id_from_string(node_id)?;

        let desc = BrowseDescription {
            node_id: nid,
            browse_direction: BrowseDirection::Forward,
            reference_type_id: ReferenceTypeId::Organizes.into(),
            include_subtypes: true,
            node_class_mask: 0xFFFF,
            result_mask: 0x3F,
        };

        let results = session
            .read()
            .browse(&[desc])
            .map_err(|e| format!("browse failed: {:?}", e))?;

        let mut nodes = Vec::new();
        if let Some(results) = results {
            for result in results {
                if let Some(refs) = result.references {
                    for r in refs {
                        nodes.push(reference_to_node_data(&r));
                    }
                }
            }
        }
        Ok(nodes)
    }

    fn read(&self, node_id: &str) -> Result<OpcuaValueData, String> {
        let session = self.get_session()?;
        let nid = node_id_from_string(node_id)?;

        let rvid = ReadValueId {
            node_id: nid,
            attribute_id: AttributeId::Value as u32,
            index_range: UAString::null(),
            data_encoding: QualifiedName::null(),
        };

        let results = session
            .read()
            .read(&[rvid], TimestampsToReturn::Both, 0.0)
            .map_err(|e| format!("read failed: {:?}", e))?;

        if results.is_empty() {
            return Err("no results".to_string());
        }
        Ok(data_value_to_opcua_value(&results[0]))
    }

    fn write(&self, node_id: &str, value: &OpcuaValueData) -> Result<(), String> {
        let session = self.get_session()?;
        let nid = node_id_from_string(node_id)?;
        let variant = json_to_variant(&value.value, &value.data_type)?;

        let wv = WriteValue {
            node_id: nid,
            attribute_id: AttributeId::Value as u32,
            index_range: UAString::null(),
            value: DataValue::value_only(variant),
        };

        let statuses = session
            .read()
            .write(&[wv])
            .map_err(|e| format!("write failed: {:?}", e))?;

        for status in statuses {
            if status.is_bad() {
                return Err(format!("write status: {:?}", status));
            }
        }
        Ok(())
    }

    fn subscribe(&mut self, node_ids: &[String], interval: f64) -> Result<String, String> {
        let session = self.get_session()?;

        let our_id = next_sub_id();
        let our_id_clone = our_id.clone();
        let push_tx = self.push_tx.clone();

        let callback = DataChangeCallback::new(move |items| {
            for item in items {
                let node_id = node_id_to_string(&item.item_to_monitor().node_id);
                let value = data_value_to_opcua_value(item.last_value());
                let msg = PushMessage {
                    msg_type: "value_change".to_string(),
                    subscription_id: Some(our_id_clone.clone()),
                    node_id,
                    value,
                };
                if let Ok(json) = serde_json::to_string(&msg) {
                    let _ = push_tx.send(json);
                }
            }
        });

        let sub_id = session
            .read()
            .create_subscription(interval, 10, 30, 0, 0, true, callback)
            .map_err(|e| format!("create subscription failed: {:?}", e))?;

        let mut items: Vec<MonitoredItemCreateRequest> = Vec::new();
        for node_id_str in node_ids {
            let nid = node_id_from_string(node_id_str)?;
            items.push(nid.into());
        }

        session
            .read()
            .create_monitored_items(sub_id, TimestampsToReturn::Both, &items)
            .map_err(|e| format!("create monitored items failed: {:?}", e))?;

        self.subscriptions.insert(our_id.clone(), sub_id);
        Ok(our_id)
    }

    fn unsubscribe(&mut self, subscription_id: &str) -> Result<(), String> {
        let sub_id = self
            .subscriptions
            .remove(subscription_id)
            .ok_or_else(|| format!("subscription not found: {}", subscription_id))?;
        let session = self.get_session()?;
        session
            .read()
            .delete_subscription(sub_id)
            .map_err(|e| format!("delete subscription failed: {:?}", e))?;
        Ok(())
    }

    fn call(
        &self,
        object_id: &str,
        method_id: &str,
        args: &[OpcuaValueData],
    ) -> Result<Vec<OpcuaValueData>, String> {
        let session = self.get_session()?;
        let oid = node_id_from_string(object_id)?;
        let mid = node_id_from_string(method_id)?;

        let variants: Result<Vec<Variant>, String> = args
            .iter()
            .map(|a| json_to_variant(&a.value, &a.data_type))
            .collect();
        let variants = variants?;

        let request: CallMethodRequest = (oid, mid, Some(variants)).into();

        let result = session
            .read()
            .call(request)
            .map_err(|e| format!("call failed: {:?}", e))?;

        Ok(result
            .output_arguments
            .unwrap_or_default()
            .iter()
            .map(|v| OpcuaValueData {
                value: variant_to_json(v),
                data_type: variant_type_name(v).to_string(),
                source_timestamp: None,
                server_timestamp: None,
                status_code: None,
            })
            .collect())
    }
}

fn run_opcua_thread(rx: mpsc::Receiver<OpcuaCommand>, push_tx: broadcast::Sender<String>) {
    let mut state = OpcuaState::new(push_tx);

    for cmd in rx {
        match cmd {
            OpcuaCommand::Connect { endpoint_url, tx } => {
                let result = state.connect(&endpoint_url);
                let _ = tx.send(result);
            }
            OpcuaCommand::Disconnect { tx } => {
                let result = state.disconnect();
                let _ = tx.send(result);
            }
            OpcuaCommand::Browse { node_id, tx } => {
                let result = state.browse(&node_id);
                let _ = tx.send(result);
            }
            OpcuaCommand::Read { node_id, tx } => {
                let result = state.read(&node_id);
                let _ = tx.send(result);
            }
            OpcuaCommand::Write { node_id, value, tx } => {
                let result = state.write(&node_id, &value);
                let _ = tx.send(result);
            }
            OpcuaCommand::Subscribe {
                node_ids,
                interval,
                tx,
            } => {
                let result = state.subscribe(&node_ids, interval);
                let _ = tx.send(result);
            }
            OpcuaCommand::Unsubscribe {
                subscription_id,
                tx,
            } => {
                let result = state.unsubscribe(&subscription_id);
                let _ = tx.send(result);
            }
            OpcuaCommand::Call {
                object_id,
                method_id,
                args,
                tx,
            } => {
                let result = state.call(&object_id, &method_id, &args);
                let _ = tx.send(result);
            }
        }
    }
}

async fn handle_connection(
    stream: TcpStream,
    cmd_tx: mpsc::Sender<OpcuaCommand>,
    mut push_rx: broadcast::Receiver<String>,
) {
    let (reader, writer) = stream.into_split();
    let mut buf_reader = BufReader::new(reader);
    let mut line = String::new();
    let writer = Arc::new(tokio::sync::Mutex::new(writer));

    let writer_clone = writer.clone();
    tokio::spawn(async move {
        loop {
            match push_rx.recv().await {
                Ok(msg) => {
                    let mut w = writer_clone.lock().await;
                    let _ = w.write_all(msg.as_bytes()).await;
                    let _ = w.write_all(b"\n").await;
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    loop {
        line.clear();
        match buf_reader.read_line(&mut line).await {
            Ok(0) => break,
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                let req: Request = match serde_json::from_str(trimmed) {
                    Ok(r) => r,
                    Err(e) => {
                        let resp = Response {
                            id: String::new(),
                            ok: false,
                            data: None,
                            error: Some(format!("invalid json: {}", e)),
                        };
                        let mut w = writer.lock().await;
                        let _ = write_response(&mut *w, &resp).await;
                        continue;
                    }
                };

                let result = handle_request(&req, &cmd_tx).await;

                let resp = match result {
                    Ok(data) => Response {
                        id: req.id,
                        ok: true,
                        data,
                        error: None,
                    },
                    Err(e) => Response {
                        id: req.id,
                        ok: false,
                        data: None,
                        error: Some(e),
                    },
                };

                let mut w = writer.lock().await;
                let _ = write_response(&mut *w, &resp).await;
            }
            Err(_) => break,
        }
    }
}

async fn handle_request(
    req: &Request,
    cmd_tx: &mpsc::Sender<OpcuaCommand>,
) -> Result<Option<serde_json::Value>, String> {
    match req.req_type.as_str() {
        "connect" => {
            let url = req.endpoint_url.as_deref().ok_or("missing endpointUrl")?;
            let (tx, rx) = oneshot::channel();
            cmd_tx
                .send(OpcuaCommand::Connect {
                    endpoint_url: url.to_string(),
                    tx,
                })
                .map_err(|_| "opcua thread disconnected".to_string())?;
            rx.await
                .map_err(|_| "opcua thread disconnected".to_string())??;
            Ok(None)
        }
        "disconnect" => {
            let (tx, rx) = oneshot::channel();
            cmd_tx
                .send(OpcuaCommand::Disconnect { tx })
                .map_err(|_| "opcua thread disconnected".to_string())?;
            rx.await
                .map_err(|_| "opcua thread disconnected".to_string())??;
            Ok(None)
        }
        "browse" => {
            let node_id = req.node_id.as_deref().ok_or("missing nodeId")?;
            let (tx, rx) = oneshot::channel();
            cmd_tx
                .send(OpcuaCommand::Browse {
                    node_id: node_id.to_string(),
                    tx,
                })
                .map_err(|_| "opcua thread disconnected".to_string())?;
            let nodes = rx
                .await
                .map_err(|_| "opcua thread disconnected".to_string())??;
            Ok(Some(
                serde_json::to_value(&nodes).map_err(|e| e.to_string())?,
            ))
        }
        "read" => {
            let node_id = req.node_id.as_deref().ok_or("missing nodeId")?;
            let (tx, rx) = oneshot::channel();
            cmd_tx
                .send(OpcuaCommand::Read {
                    node_id: node_id.to_string(),
                    tx,
                })
                .map_err(|_| "opcua thread disconnected".to_string())?;
            let value = rx
                .await
                .map_err(|_| "opcua thread disconnected".to_string())??;
            Ok(Some(
                serde_json::to_value(&value).map_err(|e| e.to_string())?,
            ))
        }
        "write" => {
            let node_id = req.node_id.as_deref().ok_or("missing nodeId")?;
            let value = req.value.as_ref().ok_or("missing value")?;
            let (tx, rx) = oneshot::channel();
            cmd_tx
                .send(OpcuaCommand::Write {
                    node_id: node_id.to_string(),
                    value: value.clone(),
                    tx,
                })
                .map_err(|_| "opcua thread disconnected".to_string())?;
            rx.await
                .map_err(|_| "opcua thread disconnected".to_string())??;
            Ok(None)
        }
        "subscribe" => {
            let node_ids = req.node_ids.as_deref().ok_or("missing nodeIds")?;
            let interval = req.sampling_interval.unwrap_or(1000.0);
            let (tx, rx) = oneshot::channel();
            cmd_tx
                .send(OpcuaCommand::Subscribe {
                    node_ids: node_ids.to_vec(),
                    interval,
                    tx,
                })
                .map_err(|_| "opcua thread disconnected".to_string())?;
            let sub_id = rx
                .await
                .map_err(|_| "opcua thread disconnected".to_string())??;
            Ok(Some(serde_json::json!({ "subscriptionId": sub_id })))
        }
        "unsubscribe" => {
            let sub_id = req
                .subscription_id
                .as_deref()
                .ok_or("missing subscriptionId")?;
            let (tx, rx) = oneshot::channel();
            cmd_tx
                .send(OpcuaCommand::Unsubscribe {
                    subscription_id: sub_id.to_string(),
                    tx,
                })
                .map_err(|_| "opcua thread disconnected".to_string())?;
            rx.await
                .map_err(|_| "opcua thread disconnected".to_string())??;
            Ok(None)
        }
        "call" => {
            let object_id = req.object_id.as_deref().ok_or("missing objectId")?;
            let method_id = req.method_id.as_deref().ok_or("missing methodId")?;
            let args = req.args.as_deref().unwrap_or(&[]);
            let (tx, rx) = oneshot::channel();
            cmd_tx
                .send(OpcuaCommand::Call {
                    object_id: object_id.to_string(),
                    method_id: method_id.to_string(),
                    args: args.to_vec(),
                    tx,
                })
                .map_err(|_| "opcua thread disconnected".to_string())?;
            let results = rx
                .await
                .map_err(|_| "opcua thread disconnected".to_string())??;
            Ok(Some(
                serde_json::to_value(&results).map_err(|e| e.to_string())?,
            ))
        }
        _ => Err(format!("unknown request type: {}", req.req_type)),
    }
}

async fn write_response(
    writer: &mut (impl AsyncWriteExt + Unpin),
    resp: &Response,
) -> std::io::Result<()> {
    let json = serde_json::to_string(resp).unwrap();
    writer.write_all(json.as_bytes()).await?;
    writer.write_all(b"\n").await?;
    Ok(())
}

#[tokio::main]
async fn main() {
    let config = Config::from_env();

    eprintln!("[edge-opcua] Starting OPC-UA transport");
    eprintln!("[edge-opcua] Listening on {}", config.listen_addr);

    let (cmd_tx, cmd_rx) = mpsc::channel::<OpcuaCommand>();
    let (push_tx, _) = broadcast::channel::<String>(256);

    let push_tx_clone = push_tx.clone();
    std::thread::spawn(move || {
        run_opcua_thread(cmd_rx, push_tx_clone);
    });

    let listener = TcpListener::bind(&config.listen_addr)
        .await
        .expect("Failed to bind TCP listener");

    loop {
        let (stream, addr) = listener.accept().await.expect("Failed to accept connection");
        eprintln!("[edge-opcua] Client connected: {}", addr);

        let cmd_tx = cmd_tx.clone();
        let push_rx = push_tx.subscribe();

        tokio::spawn(async move {
            handle_connection(stream, cmd_tx, push_rx).await;
            eprintln!("[edge-opcua] Client disconnected: {}", addr);
        });
    }
}
