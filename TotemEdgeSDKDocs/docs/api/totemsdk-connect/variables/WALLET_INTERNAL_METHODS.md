[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / WALLET\_INTERNAL\_METHODS

# Variable: WALLET\_INTERNAL\_METHODS

> `const` **WALLET\_INTERNAL\_METHODS**: readonly \[`"TOTEM_CONNECT_APPROVE"`, `"TOTEM_DISCONNECT"`, `"TOTEM_PROVE_OWNERSHIP"`, `"WOTS_SEND"`, `"WOTS_SIGN_DATA"`, `"RPC_COMMAND"`, `"START_STREAM"`, `"STOP_STREAM"`, `"GET_SNAPSHOT"`, `"GET_BALANCE_SNAPSHOT"`, `"PORTFOLIO_SNAPSHOT"`, `"GET_CONNECTED_SITES"`, `"DISCONNECT_SITE"`, `"DISCONNECT_ALL_SITES"`, `"GET_RPC_ENDPOINT"`\]

Wallet-internal verbs that are intentionally not connect methods.
Mirrors `scripts/audit-wallet-connect-parity.mjs` `WALLET_INTERNAL`.
