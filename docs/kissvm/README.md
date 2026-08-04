# KISSVM Documentation

The canonical KISSVM documentation now lives alongside the source in the `@totemsdk/kissvm` package.

## Quick links

| Resource | Location |
|----------|----------|
| **KISSVM reference** (lang spec + evaluator API) | [`packages/kissvm/docs/REFERENCE.md`](../../../packages/kissvm/docs/REFERENCE.md) |
| **Template catalog** (33 modules + 24 canonical examples) | [`packages/kissvm/docs/TEMPLATES.md`](../../../packages/kissvm/docs/TEMPLATES.md) |
| **Code gap analysis** (remaining on-chain scripts to write) | [`packages/kissvm/docs/GAPS.md`](../../../packages/kissvm/docs/GAPS.md) |
| **Evaluator source** | [`packages/kissvm/src/eval.ts`](../../../packages/kissvm/src/eval.ts) |
| **Templates source** | [`packages/kissvm/src/templates/`](../../../packages/kissvm/src/templates/) |
| **Verification tests** | [`packages/kissvm/src/__tests__/canonical-verify.ts`](../../../packages/kissvm/src/__tests__/canonical-verify.ts) |

## Minima comprehensive guide

The canonical KISSVM reference from Minima (1437 pages, 20 chapters) has been merged into the KISSVM package:

| Format | Path |
|--------|------|
| Markdown | [`packages/kissvm/docs/KISSVM_Comprehensive_Guide.md`](../../../packages/kissvm/docs/KISSVM_Comprehensive_Guide.md) |
| 24 example scripts | [`packages/kissvm/docs/examples/`](../../../packages/kissvm/docs/examples/) |
| Template manifest | [`packages/kissvm/docs/template-manifest.json`](../../../packages/kissvm/docs/template-manifest.json) |

## Related docs in this directory

| Document | Topic |
|----------|-------|
| [`../temporal-framework-design.md`](../temporal-framework-design.md) | Cross-package temporal script design |
| [`../remediation-plan.md`](../remediation-plan.md) | Per-package remediation and second hardening pass |
| [`../dead-code-inventory.md`](../dead-code-inventory.md) | 145+ dead-code findings inventory |
