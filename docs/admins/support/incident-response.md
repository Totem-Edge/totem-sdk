# Incident Response

## Severity Levels

| Level | Description | Response Time | Resolution Time |
|-------|-------------|--------------|-----------------|
| SEV-1 | Critical — security breach, key compromise, consensus failure | 1 hour | 4 hours |
| SEV-2 | High — service outage, data loss | 4 hours | 24 hours |
| SEV-3 | Medium — degraded service, non-critical bug | 24 hours | 72 hours |
| SEV-4 | Low — minor issue, cosmetic | 72 hours | Next release |

## Response Process

1. **Detection**: Issue identified via monitoring, user report, or security disclosure
2. **Triage**: Severity assessed and incident commander assigned
3. **Containment**: Immediate mitigation to prevent further impact
4. **Investigation**: Root cause analysis
5. **Resolution**: Fix developed, tested, and deployed
6. **Post-Mortem**: Document lessons learned and preventive measures

## Communication

- **Internal**: Slack #incidents channel
- **Users**: Status page update within 1 hour of SEV-1/SEV-2
- **Security**: security@totem.ing for vulnerability reports

## Escalation

See [Admin Escalation](admin-escalation.md) for the escalation matrix.
