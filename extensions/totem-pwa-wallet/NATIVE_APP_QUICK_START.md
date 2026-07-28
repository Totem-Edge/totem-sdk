# Native App Quick Start — Totem PWA Wallet Integration

This guide explains how a native Android or iOS app can call the Totem PWA wallet for signing operations (connect, verify, send transactions) and receive the result back via a custom URL scheme.

---

## Overview

```
Native App                    PWA Wallet                    Native App
    │                            │                              │
    │  Open web+totem://...      │                              │
    │───────────────────────────>│                              │
    │                            │  User approves in PWA        │
    │                            │                              │
    │  Redirect to myapp://...   │                              │
    │<───────────────────────────│                              │
    │                            │                              │
    │  Parse totem_result from   │                              │
    │  callback URL              │                              │
```

The PWA registers the `web+totem://` protocol handler. Native apps open this URL to trigger approval flows. Results are returned by redirecting to the native app's own custom scheme (e.g., `myapp://`).

---

## Prerequisites

- User has the Totem PWA **installed to their home screen** (required for protocol handler registration)
- Native app has a **custom URL scheme** registered (e.g., `myapp://`)

---

## URL Format

### Opening the PWA

```
web+totem://approval/<page>?method=<METHOD>&origin=<APP_ID>&returnUrl=<CALLBACK>&<PARAMS>
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `method` | Yes | One of: `TOTEM_CONNECT`, `TOTEM_VERIFY`, `TOTEM_SEND_TRANSACTION`, `TOTEM_SIGN_DATA` |
| `origin` | Yes | Your app's bundle ID or identifier (e.g., `com.example.myapp`) |
| `returnUrl` | Yes | Your app's callback URL (e.g., `myapp://totem-callback`) |
| `reqId` | No | Request ID for correlating responses (auto-generated if omitted) |

### Method-specific parameters

**TOTEM_CONNECT** — no extra params.

**TOTEM_VERIFY:**
| Param | Description |
|-------|-------------|
| `message` | The message to sign (URL-encoded) |
| `mode` | Set to `verify` |

**TOTEM_SEND_TRANSACTION:**
| Param | Description |
|-------|-------------|
| `to` | Recipient address |
| `amount` | Amount to send |
| `tokenId` | Token ID (optional, defaults to `0x00`) |

**TOTEM_SIGN_DATA:**
| Param | Description |
|-------|-------------|
| `unsignedHex` | Raw hex data to sign |
| `inputAddresses` | Comma-separated addresses |
| `inputIndices` | Comma-separated address indices |

### Example URLs

```
web+totem://approval/connect.html?method=TOTEM_CONNECT&origin=com.example.myapp&returnUrl=myapp://totem-callback

web+totem://approval/verify.html?method=TOTEM_VERIFY&origin=com.example.myapp&returnUrl=myapp://totem-callback&message=Sign%20in%20to%20MyApp&mode=verify

web+totem://approval/send.html?method=TOTEM_SEND_TRANSACTION&origin=com.example.myapp&returnUrl=myapp://totem-callback&to=0xMx...&amount=10
```

---

## Receiving the Result

The PWA redirects to your `returnUrl` with the result appended as query parameters:

```
myapp://totem-callback?totem_result=<base64>&totem_reqid=<id>
```

### Decoding the result

The `totem_result` parameter is base64-encoded JSON. Decode it to get the response:

```typescript
const decoded = JSON.parse(atob(totem_result));
```

### Response shapes

**TOTEM_CONNECT (success):**
```json
{
  "connected": true,
  "address": "0xMx...",
  "addressIndex": 0,
  "publicKey": "0x...",
  "isReconnect": false
}
```

**TOTEM_VERIFY (success):**
```json
{
  "verified": true,
  "verificationId": "verify_1712345678",
  "address": "0xMx...",
  "publicKey": "0x...",
  "signature": "0x...",
  "message": "Sign in to MyApp",
  "expiresAt": 1712349278000
}
```

**TOTEM_SEND_TRANSACTION (success):**
```json
{
  "success": true,
  "txpowid": "dapp-1712345678-a1b2c3",
  "status": "submitted"
}
```

**Error (all methods):**
```json
{
  "error": "User rejected connection"
}
```

---

## Android Setup

### 1. Register your callback scheme

In `AndroidManifest.xml`:

```xml
<activity android:name=".TotemCallbackActivity"
    android:exported="true"
    android:launchMode="singleTask">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="myapp" android:host="totem-callback" />
    </intent-filter>
</activity>
```

### 2. Open the PWA

```kotlin
val uri = Uri.parse("web+totem://approval/connect.html?method=TOTEM_CONNECT&origin=com.example.myapp&returnUrl=myapp://totem-callback")
val intent = Intent(Intent.ACTION_VIEW, uri)
startActivity(intent)
```

### 3. Handle the callback

```kotlin
class TotemCallbackActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val data = intent?.data
        val totemResult = data?.getQueryParameter("totem_result")
        val reqId = data?.getQueryParameter("totem_reqid")
        if (totemResult != null) {
            val json = String(Base64.decode(totemResult, Base64.DEFAULT))
            // Parse JSON and handle the result
        }
        finish()
    }
}
```

---

## iOS Setup

### 1. Register your callback scheme

In `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>myapp</string>
        </array>
    </dict>
</array>
```

Also add `web+totem` to `LSApplicationQueriesSchemes`:

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>web+totem</string>
</array>
```

### 2. Open the PWA

```swift
let urlString = "web+totem://approval/connect.html?method=TOTEM_CONNECT&origin=com.example.myapp&returnUrl=myapp://totem-callback"
guard let url = URL(string: urlString) else { return }
UIApplication.shared.open(url)
```

### 3. Handle the callback

In `AppDelegate`:

```swift
func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    guard url.scheme == "myapp" else { return false }
    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    let totemResult = components?.queryItems?.first(where: { $0.name == "totem_result" })?.value
    let reqId = components?.queryItems?.first(where: { $0.name == "totem_reqid" })?.value
    if let totemResult = totemResult,
       let data = Data(base64Encoded: totemResult),
       let json = try? JSONSerialization.jsonObject(with: data) {
        // Handle the result
    }
    return true
}
```

---

## Security Notes

- **Return URL allowlist** — The PWA only allows `https`, `http`, `myapp`, and `totem` schemes for return URLs. If your app uses a different scheme, contact the PWA team to add it.
- **Origin** — The `origin` parameter should be your app's bundle ID or a stable identifier. It is displayed to the user during approval.
- **No postMessage** — Native apps cannot use `postMessage` or `BroadcastChannel`. All results are delivered via URL redirect.
- **Timeout** — WOTS signing can take 10–40 seconds. The PWA has a 90-second timeout on all requests.

---

## Testing

1. Install the PWA to your device's home screen
2. Open the PWA at least once to ensure the protocol handler is registered
3. From your native app, open a `web+totem://` URL
4. The PWA should open to the approval page
5. After approval, your app's callback URL should be invoked with the result

---

## Troubleshooting

| Problem | Likely cause |
|---------|-------------|
| PWA doesn't open | PWA not installed to home screen |
| `web+totem://` URL does nothing | Protocol handler not registered — re-install the PWA |
| Callback URL not received | Custom scheme not registered in native app's `Info.plist` / `AndroidManifest.xml` |
| `totem_result` is malformed | Base64 decode error — ensure you're using the correct decoding method |
| "Return URL scheme not allowed" | Your `returnUrl` scheme is not in the allowlist |
