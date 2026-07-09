> **Historical Document — v1.0.0 SDK Migration Era (November 2025)**
> This document was created during the initial SDK migration from legacy wallet code.
> The migration is now complete (v2.1.0, February 2026). Retained as a historical record.

# Totem Recovery CLI

A command-line tool for recovering and managing wallet state during SDK migration issues.

## Installation

```bash
# Install globally
npm install -g @totem/recovery-cli

# Or use npx
npx @totem/recovery-cli <command>
```

## Commands

### `export` - Export Wallet State

Exports the current wallet state to a JSON backup file.

```bash
totem-recovery export [options]

Options:
  -o, --output <file>    Output file path (default: backup-<timestamp>.json)
  -f, --format <format>  Output format: json, encrypted (default: json)
  -p, --password         Prompt for encryption password (required for encrypted format)
  --include-sensitive    Include sensitive data (seed material) - use with caution

Examples:
  totem-recovery export --output my-backup.json
  totem-recovery export --format encrypted --password
```

**Output Structure:**
```json
{
  "version": "1.0.0",
  "exportedAt": "2025-11-26T12:00:00Z",
  "wallet": {
    "addresses": ["Mx..."],
    "watermark": {
      "next_l1": 0,
      "next_l2": 0,
      "next_l3": 1,
      "usedIndices": []
    },
    "leases": [],
    "balanceCache": {}
  },
  "metadata": {
    "extensionVersion": "1.2.3",
    "initMode": "sdk",
    "lastSync": "2025-11-26T12:00:00Z"
  }
}
```

### `restore` - Restore Wallet State

Restores wallet state from a backup file.

```bash
totem-recovery restore [options]

Options:
  -i, --input <file>     Input backup file path (required)
  -p, --password         Prompt for decryption password (for encrypted backups)
  --dry-run              Show what would be restored without making changes
  --force                Skip confirmation prompts

Examples:
  totem-recovery restore --input backup-20251126.json
  totem-recovery restore --input backup.json.enc --password
  totem-recovery restore --input backup.json --dry-run
```

**Restore Process:**
1. Validates backup file integrity
2. Checks version compatibility
3. Prompts for confirmation (unless --force)
4. Restores watermark state
5. Restores lease state
6. Clears balance cache (will resync)
7. Verifies restoration

### `sync-watermark` - Sync Watermark from Server

Fetches the latest watermark state from the Axia server and updates local state.

```bash
totem-recovery sync-watermark [options]

Options:
  -a, --address <addr>   Wallet address (required)
  --api-url <url>        Axia API URL (default: https://api.axia.network)
  --project-id <id>      Project ID for API access
  --force                Overwrite local state even if newer

Examples:
  totem-recovery sync-watermark --address Mx1234...
  totem-recovery sync-watermark --address Mx1234... --force
```

**Sync Logic:**
```
Server Watermark   Local Watermark   Action
-----------------  ----------------  ----------------------
Higher indices     Lower indices     Update local to server
Lower indices      Higher indices    Keep local (warn user)
Equal              Equal             No action needed
```

### `recover-leases` - Recover Lease State

Recovers lease state by querying the server for active leases.

```bash
totem-recovery recover-leases [options]

Options:
  -a, --address <addr>   Wallet address (required)
  --release-expired      Release any expired leases found
  --force                Force re-acquisition of leases

Examples:
  totem-recovery recover-leases --address Mx1234...
  totem-recovery recover-leases --address Mx1234... --release-expired
```

### `reset-leases` - Reset All Leases

Clears all local lease state and optionally releases server-side leases.

```bash
totem-recovery reset-leases [options]

Options:
  -a, --address <addr>   Wallet address (required)
  --release-server       Also release leases on server
  --force                Skip confirmation prompt

Examples:
  totem-recovery reset-leases --address Mx1234... --force
  totem-recovery reset-leases --address Mx1234... --release-server
```

**Warning:** This will clear all pending transactions. Use only when lease state is corrupted.

### `validate` - Validate Wallet State

Checks wallet state for inconsistencies and potential issues.

```bash
totem-recovery validate [options]

Options:
  -a, --address <addr>   Wallet address (required)
  --fix                  Attempt to fix detected issues
  --report <file>        Output validation report to file

Examples:
  totem-recovery validate --address Mx1234...
  totem-recovery validate --address Mx1234... --fix
  totem-recovery validate --address Mx1234... --report validation.txt
```

**Validation Checks:**
- Watermark index consistency
- Lease expiration status
- Balance cache freshness
- Storage integrity
- Server synchronization status

### `migrate` - Manual Migration Control

Manually control SDK migration state.

```bash
totem-recovery migrate [options]

Options:
  --mode <mode>          Set init mode: sdk, legacy, auto (default: auto)
  --status               Show current migration status
  --reset-telemetry      Clear migration telemetry data

Examples:
  totem-recovery migrate --status
  totem-recovery migrate --mode legacy
  totem-recovery migrate --mode sdk
```

## Configuration

Create a `.totemrc` file in your home directory:

```json
{
  "apiUrl": "https://api.axia.network",
  "projectId": "your-project-id",
  "extensionPath": "/path/to/extension/profile",
  "defaultFormat": "encrypted"
}
```

Environment variables:
```bash
AXIA_API_URL=https://api.axia.network
AXIA_PROJECT_ID=your-project-id
TOTEM_EXTENSION_PATH=/path/to/extension
```

## Common Recovery Scenarios

### Scenario 1: Wallet Won't Unlock After SDK Update

```bash
# 1. Switch to legacy mode
totem-recovery migrate --mode legacy

# 2. Export current state
totem-recovery export --output pre-fix-backup.json

# 3. Reload extension and try unlock
```

### Scenario 2: Balance Showing Incorrect Amount

```bash
# 1. Validate current state
totem-recovery validate --address Mx1234...

# 2. Sync watermark
totem-recovery sync-watermark --address Mx1234...

# 3. Clear and resync balance
totem-recovery clear-cache --address Mx1234...
```

### Scenario 3: Transaction Stuck / Lease Issues

```bash
# 1. Check lease status
totem-recovery recover-leases --address Mx1234...

# 2. If leases are corrupted, reset
totem-recovery reset-leases --address Mx1234... --force

# 3. Verify watermark is correct
totem-recovery sync-watermark --address Mx1234...
```

### Scenario 4: Complete State Recovery from Backup

```bash
# 1. Restore from backup
totem-recovery restore --input backup.json --force

# 2. Sync with server to get latest state
totem-recovery sync-watermark --address Mx1234...

# 3. Validate restored state
totem-recovery validate --address Mx1234...
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | File not found |
| 4 | Network error |
| 5 | Authentication required |
| 6 | State validation failed |
| 7 | Backup corrupted |

## Logging

Enable verbose logging:
```bash
TOTEM_LOG_LEVEL=debug totem-recovery <command>
```

Log levels: `error`, `warn`, `info`, `debug`, `trace`

## Security Considerations

1. **Backup Encryption:** Always use `--format encrypted` for backups containing sensitive data
2. **Secure Storage:** Store backup files in a secure location
3. **Password Strength:** Use strong passwords for encrypted backups
4. **Temporary Files:** The CLI cleans up temporary files after operations
5. **Network Security:** All API calls use TLS

## Troubleshooting

### "Extension profile not found"
Ensure the extension is installed and specify the correct profile path:
```bash
totem-recovery --extension-path ~/.config/chromium/Default/Extensions/...
```

### "API authentication failed"
Set your project credentials:
```bash
export AXIA_PROJECT_ID=your-project-id
```

### "Watermark conflict detected"
Server has different watermark than local. Use `--force` to overwrite local:
```bash
totem-recovery sync-watermark --address Mx1234... --force
```
