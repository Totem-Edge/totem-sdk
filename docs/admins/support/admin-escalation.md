# Admin Escalation

## Escalation Matrix

| Level | Role | Contact |
|-------|------|---------|
| L1 | Support Team | GitHub Issues, Community Discord |
| L2 | Engineering Team | Internal Slack #engineering |
| L3 | Security Team | security@totem.ing |
| L4 | Executive Team | Emergency contact list |

## When to Escalate

- **L1 → L2**: Bug confirmed, requires code change
- **L2 → L3**: Security vulnerability, cryptographic issue, key management concern
- **L3 → L4**: Critical security breach, legal concern, major outage

## Escalation Template

```
Subject: [ESCALATION] [SEV-{level}] {brief description}

Severity: SEV-{1-4}
Detected: {timestamp}
Affected: {packages/services}
Impact: {description of impact}
Current Status: {containment/mitigation status}
Action Required: {what is needed from escalated team}
```

## On-Call Rotation

The on-call schedule is maintained in the internal operations calendar. Contact the current on-call engineer via the emergency contact list.
