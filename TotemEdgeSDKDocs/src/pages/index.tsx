import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './index.module.css';

const APPS = [
  {
    slug: 'tessa-pay',
    icon: '🏪',
    title: 'TESSA Pay',
    description: 'Edge-native merchant POS with policy-controlled payments and auto-approve rules.',
    packages: ['connect', 'agent-policy', 'wots-lease', 'tx-builder', 'txpow', 'chain-provider'],
  },
  {
    slug: 'totem-personal-node',
    icon: '📱',
    title: 'Totem Personal Node',
    description: 'Always-on personal node for multi-device coordination with shared WOTS lease strategy.',
    packages: ['lookup-node', 'lookup-protocol', 'agent-policy', 'pureminima-rpc', 'chain-provider'],
  },
  {
    slug: 'kissvm-studio',
    icon: '🛠️',
    title: 'KISSVM Studio',
    description: 'Local developer IDE for writing and simulating KISSVM scripts with a policy safety linter.',
    packages: ['kissvm', 'agent-policy', 'tx-builder', 'chain-provider', 'pureminima-rpc'],
  },
  {
    slug: 'statechain-pass',
    icon: '🎟️',
    title: 'Statechain Pass',
    description: 'Transferable off-chain ownership of tickets, vouchers, and access rights.',
    packages: ['statechain', 'agent-policy', 'wots-lease', 'chain-provider', 'connect'],
  },
  {
    slug: 'omnia-pocket',
    icon: '💸',
    title: 'Omnia Pocket',
    description: 'Mobile/Pear off-chain payment-channel wallet with policy guards and settlement triggers.',
    packages: ['omnia', 'omnia-hyperswarm', 'agent-policy', 'pear', 'wots-lease', 'txpow'],
  },
  {
    slug: 'channel-factory-wallet',
    icon: '🏭',
    title: 'Channel Factory Wallet',
    description: 'Group N-of-N factory channels with policy-defined roles and emergency-close rules.',
    packages: ['omnia-factory', 'omnia', 'omnia-splice', 'agent-policy', 'wots-lease', 'txpow'],
  },
  {
    slug: 'omnia-router-node',
    icon: '🔀',
    title: 'Omnia Router Node',
    description: 'Liquidity and payment-routing node with policy-controlled routes and fee floors.',
    packages: ['omnia-router', 'omnia', 'omnia-hyperswarm', 'agent-policy', 'lookup-node', 'pear'],
  },
  {
    slug: 'totem-community-node',
    icon: '🏘️',
    title: 'Totem Community Node',
    description: 'Finance infrastructure for cooperatives, schools, and markets with policy templates.',
    packages: ['lookup-node', 'lookup-client', 'agent-policy', 'omnia-router', 'realtime'],
  },
  {
    slug: 'machinepay-edge',
    icon: '⚡',
    title: 'MachinePay Edge',
    description: 'Pay-per-use device gateway for Wi-Fi, solar, and compute with auto-shutdown policy.',
    packages: ['omnia', 'omnia-hyperswarm', 'statechain', 'agent-policy', 'pear', 'wots-lease'],
  },
];

const PACKAGES = [
  { name: '@totemsdk/core', desc: 'WOTS cryptography, TreeKey derivation, serialization' },
  { name: '@totemsdk/connect', desc: 'Browser dApp ↔ Totem extension provider bridge' },
  { name: '@totemsdk/node', desc: 'Node.js wallet with full Wallet.java parity' },
  { name: '@totemsdk/root-identity', desc: 'Root identity controlling up to 64 on-chain addresses' },
  { name: '@totemsdk/agent-policy', desc: 'QVAC AI bridge — policy evaluation seam' },
  { name: '@totemsdk/omnia', desc: 'Eltoo payment channel state machines' },
  { name: '@totemsdk/omnia-factory', desc: 'N-of-N group channel factory protocol' },
  { name: '@totemsdk/omnia-router', desc: 'Multi-hop payment routing and fee logic' },
  { name: '@totemsdk/omnia-splice', desc: 'Channel resizing without closing' },
  { name: '@totemsdk/omnia-hyperswarm', desc: 'Hyperswarm peer transport for Omnia peers' },
  { name: '@totemsdk/pear', desc: 'Pear/Holepunch runtime integration' },
  { name: '@totemsdk/kissvm', desc: 'KISSVM script lexer, parser, and evaluator' },
  { name: '@totemsdk/statechain', desc: 'Off-chain transferable ownership chains' },
  { name: '@totemsdk/txpow', desc: 'TxPoW proof-of-work difficulty calibration' },
  { name: '@totemsdk/wots-lease', desc: 'WOTS key lease lifecycle management' },
  { name: '@totemsdk/tx-builder', desc: 'High-level transaction builder DSL' },
  { name: '@totemsdk/lookup-client', desc: 'Lookup network client — address resolution' },
  { name: '@totemsdk/lookup-node', desc: 'Run a Hyperswarm-based lookup node' },
  { name: '@totemsdk/lookup-protocol', desc: 'Wire protocol types and framing' },
  { name: '@totemsdk/chain-provider', desc: 'Unified Minima node RPC abstraction' },
  { name: '@totemsdk/realtime', desc: 'WebSocket real-time balance and event streams' },
  { name: '@totemsdk/pureminima-rpc', desc: 'Low-level Minima RPC client' },
];

function AppCard({ app }: { app: typeof APPS[0] }) {
  return (
    <Link to={`/guides/${app.slug}`} className="app-card">
      <span className="app-card__icon">{app.icon}</span>
      <div className="app-card__title">{app.title}</div>
      <div className="app-card__description">{app.description}</div>
      <div className="app-card__packages">
        {app.packages.slice(0, 4).map(pkg => (
          <span key={pkg} className="app-card__package-badge">{pkg}</span>
        ))}
        {app.packages.length > 4 && (
          <span className="app-card__package-badge">+{app.packages.length - 4}</span>
        )}
      </div>
    </Link>
  );
}

function PackageIndex() {
  return (
    <section style={{ padding: '3rem 0' }}>
      <div className="container">
        <h2 style={{ marginBottom: '0.5rem' }}>Package Index</h2>
        <p style={{ color: 'var(--ifm-color-emphasis-700)', marginBottom: '1.5rem' }}>
          22 packages covering cryptography, channels, routing, and AI policy.{' '}
          <Link to="/api">Browse full API reference →</Link>
        </p>
        <div className="pkg-index-grid">
          {PACKAGES.map(pkg => (
            <div key={pkg.name} className="pkg-index-item">
              <div className="pkg-index-item__name">{pkg.name}</div>
              <div className="pkg-index-item__desc">{pkg.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): React.ReactElement {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title="Totem Edge SDK" description={siteConfig.tagline}>
      <header className="hero hero--primary">
        <div className="container">
          <h1 className="hero__title">Totem Edge SDK</h1>
          <p className="hero__subtitle" style={{ maxWidth: 600, margin: '1rem auto 2rem' }}>
            Build sovereign, AI-ready applications on the Minima network.
            Quantum-resistant cryptography, off-chain payment channels, and an agent policy seam
            that keeps your users in control.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="button button--primary button--lg" to="/concepts/agent-policy-overview">
              Understand the Model
            </Link>
            <Link className="button button--secondary button--lg" to="/guides/tessa-pay">
              See Example Apps
            </Link>
            <Link className="button button--secondary button--lg" to="/api">
              API Reference
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section style={{ padding: '3rem 0' }}>
          <div className="container">
            <h2 style={{ marginBottom: '0.5rem' }}>Nine canonical apps</h2>
            <p style={{ color: 'var(--ifm-color-emphasis-700)', marginBottom: '1.5rem' }}>
              From a corner-shop POS to a multi-hop routing node — each guide walks through a real
              integration path with full package wiring and a QVAC hook callout.{' '}
              <Link to="/concepts/agent-policy-overview">What is QVAC? →</Link>
            </p>
            <div className="app-card-grid">
              {APPS.map(app => <AppCard key={app.slug} app={app} />)}
            </div>
          </div>
        </section>

        <PackageIndex />

        <section style={{ padding: '2rem 0 3rem', textAlign: 'center' }}>
          <div className="container">
            <h2>Agent-ready by design</h2>
            <p style={{ maxWidth: 600, margin: '0 auto 1.5rem' }}>
              Every page is static HTML — no JavaScript rendering required for AI crawlers.
              Fetch <code>/llms.txt</code> for a structured page index, or <code>/llms-full.txt</code>
              {' '}for the complete SDK knowledge base in a single request.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="button button--outline button--primary" to="/llms.txt">
                llms.txt
              </Link>
              <Link className="button button--outline button--primary" to="/llms-full.txt">
                llms-full.txt
              </Link>
              <Link className="button button--outline button--primary" to="/docs-manifest.json">
                docs-manifest.json
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
