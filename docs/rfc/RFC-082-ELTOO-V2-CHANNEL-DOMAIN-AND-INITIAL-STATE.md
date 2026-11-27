# RFC-082 — Eltoo v2 channel domain and pre-funding initial state

**Status:** implemented in the SDK; **Java/Hawk parity must be confirmed before the
next release.** This is a channel-script and opening-handshake change, so a node
that implements the v1 eltoo script cannot open or repair a v2 channel until it
adopts this RFC.

**Findings:** OMN-097 (no consensus-enforced channel domain) and OMN-098 (a
channel is funded before either party holds a unilateral exit package).

## 1. Channel domain (OMN-097)

### Problem

The v1 funding script is derived only from the two public keys and the contest
delay. Two channels between the same parties with the same delay therefore share
a script (and address), and the covenant never binds a successor to the channel
being spent. The signed off-chain state is not bound by the script.

### v2 script

The channel id is hashed into a fixed-length domain value and embedded in the
script as a constant. A new state port carries it:

| Port | Meaning              |
| ---- | -------------------- |
| 100  | settlement flag      |
| 101  | sequence             |
| 102  | state commitment v2  |
| 103  | **channel domain**   |

```
LET settlement=STATE(100)
LET sequence=STATE(101)
LET prevsequence=PREVSTATE(101)
LET domain=STATE(103)
LET prevdomain=PREVSTATE(103)
ASSERT domain EQ 0x<deriveChannelDomain(channelId)>
LET bothsigned=MULTISIG(2 A B)
IF settlement THEN
    ASSERT bothsigned
    ASSERT domain EQ prevdomain
    ASSERT sequence EQ prevsequence
    ASSERT @COINAGE GTE <delay>
    RETURN TRUE
ENDIF
ASSERT bothsigned
ASSERT sequence GT prevsequence
ASSERT domain EQ prevdomain
RETURN TRUE
```

`deriveChannelDomain(channelId) = SHA3-256(utf8(channelId))`, hex encoded.
Consequences:

- The funding transaction writes `STATE(103)` on the channel coin.
- Every update and settlement transaction must carry the same value; the
  covenant rejects a successor that changes or omits it.
- Two channels with identical parties and delay now have different scripts and
  addresses, and the update digest commits to the channel address, so a state
  signed for channel A cannot be executed against channel B.

### Compatibility

- New channels built by `buildChannelOpening` / `acceptChannel` are always v2.
- `acceptChannel` still accepts a **legacy v1 proposal** when its script matches
  the v1 rebuild exactly; the resulting channel keeps the v1 script and does not
  carry the domain state. No new channel can be created as v1.
- `buildEltooScript(parties, delay)` without `domainId` produces the legacy v1
  script; only explicit legacy tooling should use it.
- Splice outputs preserve `STATE(103)` for v2 channels (`SpliceTxOutput.stateVarDomain`).

## 2. Initial state before funding (OMN-098)

### Problem

The opening builder funded the channel with `latestState: null` and sequence 0.
`startUnilateralClose` requires a signed state with a close package, so during
the opening window the funding coin existed with no independent recovery path.

### Handshake

1. The initiator builds the opening plan (no broadcast) and signs the
   sequence-0 state locally (`signInitialChannelState`). The partial state
   carries the update, settlement and close-package signatures.
2. The initiator sends `CHANNEL_OPEN_COSIGN { proposal, partial }` to the
   counterparty.
3. The acceptor validates the proposal and script without a chain provider,
   verifies the initiator's partial state, signs its own sequence-0 state, merges
   via `attachCounterpartySignature`, requires `verifyClosePackage` to pass, and
   replies `CHANNEL_OPEN_COSIGN_REPLY { partial }`.
4. The initiator merges the reply, verifies the close package, and only then
   calls `finalizeChannelOpening` with `initialState`.
5. `finalizeChannelOpening` refuses to broadcast when the state is absent, is
   not sequence 0, has balances that differ from the opening split, or has a
   close package that does not verify.
6. `recover()`-style restarts can start a unilateral close from the persisted
   sequence-0 state immediately, because both close artifacts already exist.

`allowMissingInitialState` (SDK) and `allowLocalOnlyOpen` / `allowLocalOnlyPay`
(host) are explicit local-dev escapes; they are never set on a network open.

## 3. Parity confirmation

The covenant was evaluated against the pinned Java oracle and Hawk's C++ KISSVM
during the same differential (`hawk-node/tests/parity/kernel/run_kernel.sh`):

```
kernel_digest: ef0bc4d6a986524bce37b192808301b022b8da0392e902d501ac6b05f426e4f5
oracle_commit: c2a54a2e46b2c3a4fd541b80e7d7f5e7afe7d4da
PASS
```

Eight `omnia-v2/` cases are compared line-for-line:

| case | Hawk = Java (parse;success;exception) |
| --- | --- |
| update-ok | 1;1;0 |
| update-sibling-domain | 1;0;0 |
| update-changed-domain | 1;0;0 |
| update-missing-domain | 1;0;1 |
| settlement-ok | 1;1;0 |
| settlement-short-coinage | 1;0;0 |
| settlement-sibling-domain | 1;0;0 |
| settlement-changed-domain | 1;0;0 |

The same eight cases are pinned in the SDK by
`tests/unit/omnia/src/__tests__/eltoo-v2-parity.test.ts` (including exact script
equality with the harness literal), so the TypeScript, C++ and Java evaluators
are checked against one fixture.

## 4. Release requirements

- **Hawk and the Java node must implement the v2 script and reject a v1 state
  replayed against a v2 channel** before this ships as the default. The KISSVM
  parity above covers evaluation of the covenant; the Java node's own channel
  code (if it builds eltoo scripts) must also emit `STATE(103)`.
- The SDK-side tests cover the script, funding/settlement/update state ports,
  splice preservation, the co-sign handshake, and the funding gate
  (`tests/unit/omnia/src/__tests__/omnia.test.ts`,
  `tests/unit/omnia-host/src/__tests__/prepare-submit-open.test.ts`,
  `tests/unit/omnia-host/src/__tests__/e2e.test.ts`).
- This changes the on-chain channel script: it is a minor release for a `0.x`
  package and a major release for a `1.x` package under
  [../RELEASE-PROCESS.md](../RELEASE-PROCESS.md).
