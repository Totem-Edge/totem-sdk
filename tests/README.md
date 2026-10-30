# Repository tests

Testing does not live inside publishable packages.

- `tests/unit/<package>/` — unit/contract tests.
- `tests/qualification/<package>/` — integration, conformance, recovery and packed-consumer profiles.
- `tests/jest/` — centralized runners.
- `qualification/registry.json` — owner/profile/limitation metadata for release gates.

Packages contain runtime source, build configuration, docs and packaging metadata only.
Package `test:*` scripts are thin delegates for repository CI; they are not shipped.
