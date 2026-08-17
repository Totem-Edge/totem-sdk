# Contributing to Totem SDK

Thank you for contributing to Totem SDK! This document outlines the process for contributing code, documentation, and other improvements.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Development Setup

```bash
git clone https://github.com/Totem-Edge/totem-sdk.git
cd totem-sdk
pnpm install
```

### Project Structure

The project is a pnpm monorepo with the following structure:

```
packages/           # 55 SDK packages (@totemsdk/*)
extensions/         # Apps & extensions
├── totem-extension/            # Chrome MV3 browser extension
├── totem-pwa-wallet/           # PWA wallet
├── totem-dapp-starter/         # dApp starter template
├── totem-pear-android-starter/ # Android Pear runtime starter
└── observability/              # Telemetry & observability
```

## Development Workflow

### 1. Find or Create an Issue

- Check existing [issues](https://github.com/Totem-Edge/totem-sdk/issues) before starting work
- For bugs, include steps to reproduce and expected behavior
- For features, describe the use case and proposed solution

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feature/*` — new features
- `fix/*` — bug fixes
- `docs/*` — documentation changes
- `chore/*` — maintenance tasks
- `security/*` — security fixes

### 3. Make Your Changes

- Follow the existing code style and conventions
- Write tests for new functionality
- Ensure all existing tests pass
- Update documentation as needed

### 4. Run Tests

```bash
# Run SDK tests
pnpm test

# Run extension tests
pnpm test:extension
```

### 5. Commit Your Changes

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add new WOTS parameter set
fix(omnia): resolve channel settlement race condition
docs(api): update provider API documentation
chore(deps): update @noble/hashes to v2.0.0
```

### 6. Create a Pull Request

- Fill out the PR template completely
- Link to the related issue
- Include a description of changes
- Note any breaking changes
- Request review from appropriate maintainers

## Code Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Use explicit types (avoid `any`)
- Prefer `interface` over `type` for object shapes
- Use `const` assertions for literal types

### Testing

- Unit tests for all new functionality
- Integration tests for cross-package interactions
- Parity tests for cryptographic code (must match Java reference)
- Test coverage should not decrease

### Documentation

- JSDoc comments for all public APIs
- README updates for new packages
- API reference updates via TypeDoc
- Changelog entries for user-facing changes

## Cryptographic Code Requirements

Changes to cryptographic code (`packages/core/`) have additional requirements:

1. **Review**: At least 2 maintainer approvals required
2. **Parity Tests**: Must pass parity tests against Java reference implementation
3. **Backward Compatibility**: Key derivation changes must maintain backward compatibility
4. **Security Assessment**: Include a security impact assessment in the PR description
5. **No New Dependencies**: No new cryptographic dependencies without security review

See [docs/security/crypto-policy.md](docs/security/crypto-policy.md) for the complete cryptographic security policy.

## Package Publishing

Only maintainers can publish packages. Every package marked `publishable` in
`scripts/workspace-gates.config.json` is eligible for the same release workflow;
the workflow resolves the package from the release tag instead of maintaining a
second hardcoded package list.

The admin publishing process is one GitHub button:

1. Version bump following semver
2. Update CHANGELOG.md
3. Confirm the package passes `node scripts/validate-pkg-meta.mjs` and the workspace gates
4. Create a draft GitHub Release with a tag matching the package name, e.g. `totemsdk/core-v1.2.0`
5. Human admin reviews the draft and clicks **Publish release**
6. CI/CD checks out that exact tag, builds the dependency closure, runs tests, validates the packed consumer, and publishes to npm with provenance

Tags must use `totemsdk/<package-slug>-v<semver>`, where the package slug is the
part after `@totemsdk/`. For example, `@totemsdk/omnia-host@0.1.0` uses
`totemsdk/omnia-host-v0.1.0`.

The production publish job uses the GitHub Environment `npm-production`. Configure
that environment in repository settings with required reviewers if the npm admin
must approve the final deployment gate after the GitHub Release is published.

## Getting Help

- **Questions**: Open a [GitHub Discussion](https://github.com/Totem-Edge/totem-sdk/discussions)
- **Bugs**: Open a [GitHub Issue](https://github.com/Totem-Edge/totem-sdk/issues)
- **Security**: See [SECURITY.md](SECURITY.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
