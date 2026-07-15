# Node Pool Policy

## Overview

This document defines the policy for managing Minima node pools used by Totem SDK infrastructure.

## Node Requirements

- Minima node version: Latest stable
- Minimum uptime: 99.5%
- Resource requirements: 4 CPU, 8GB RAM, 100GB SSD
- Network: Public IPv4, ports 9001-9005 open

## Pool Management

- **Minimum pool size**: 3 nodes
- **Maximum pool size**: 10 nodes
- **Scaling trigger**: >80% CPU utilization sustained for 5 minutes
- **Health check**: Every 30 seconds via `/status` endpoint

## Security

- All nodes must run behind a firewall
- API access restricted to authorized IPs
- Regular security updates applied within 24 hours of release
- Node keys rotated every 90 days

## Monitoring

- Prometheus metrics exported on port 9090
- Grafana dashboards for pool health
- Alert on: node down, high latency, disk >80%, memory >90%

## Incident Response

See [Incident Response](../support/incident-response.md) for the full incident response process.
