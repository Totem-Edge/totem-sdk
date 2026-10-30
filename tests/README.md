# Repository tests

Testing does not live inside publishable packages.

- `tests/unit/<package>/` — unit/contract tests.
- `tests/qualification/<package>/` — integration, conformance, recovery and packed-consumer profiles.
- `tests/jest/` — centralized runners.
- `qualification/registry.json` — owner/profile/limitation metadata for release gates.

Packages contain runtime source, build configuration, docs and packaging metadata only.
Package `test:*` scripts are thin delegates for repository CI; they are not shipped.


## Package documentation signposting

Every migrated package README must include a **Testing** section pointing to:

- its unit suite under `tests/unit/<package>/`
- its qualification suites under `tests/qualification/<package>/`
- `qualification/registry.json` for owner/profile/limitation metadata

Tests are not shipped in npm tarballs. Package `test:*` scripts are repository
delegates, not package-local test implementations.
