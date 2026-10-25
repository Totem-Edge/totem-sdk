/**
 * GENERATED — do not edit by hand.
 *
 * Source: hawk-node COMMAND_REFERENCE.md (totem-node 1.0.100.0, 132 commands).
 * Regenerate: node scripts/generate-minima-rpc-commands.mjs <COMMAND_REFERENCE.md>
 *
 * The node accepts named params, but guarding names/order here catches typos,
 * missing required values and enum drift before a request reaches the node.
 */

export type MinimaCommandParamType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface MinimaCommandParam {
  readonly name: string;
  readonly type: MinimaCommandParamType;
  readonly required: boolean;
  readonly enum?: readonly string[];
}

export const MINIMA_COMMAND_PARAMS = {
  "archive": [
    { name: "action", type: 'string', required: true },
    { name: "host", type: 'string', required: false },
    { name: "phrase", type: 'string', required: false },
    { name: "keys", type: 'string', required: false },
    { name: "keyuses", type: 'number', required: false },
  ],
  "backup": [
    { name: "password", type: 'string', required: false },
    { name: "file", type: 'string', required: false },
    { name: "auto", type: 'string', required: false },
    { name: "maxhistory", type: 'number', required: false },
  ],
  "coinexport": [
    { name: "coinid", type: 'string', required: true },
  ],
  "coinimport": [
    { name: "data", type: 'string', required: true },
    { name: "track", type: 'boolean', required: false, enum: ["true", "false"] },
  ],
  "duckdb": [],
  "duckdbcoins": [],
  "megammr": [
    { name: "action", type: 'string', required: false },
    { name: "file", type: 'string', required: false },
  ],
  "megammrsync": [
    { name: "action", type: 'string', required: true },
    { name: "host", type: 'string', required: true },
    { name: "phrase", type: 'string', required: false },
    { name: "keys", type: 'string', required: false },
    { name: "keyuses", type: 'number', required: false },
    { name: "file", type: 'string', required: false },
    { name: "password", type: 'string', required: false },
  ],
  "reset": [
    { name: "archivefile", type: 'string', required: true },
    { name: "action", type: 'string', required: true },
    { name: "file", type: 'string', required: false },
    { name: "password", type: 'string', required: false },
    { name: "keys", type: 'string', required: false },
    { name: "keyuses", type: 'number', required: false },
  ],
  "restore": [
    { name: "file", type: 'string', required: true },
    { name: "password", type: 'string', required: false },
  ],
  "restoresync": [
    { name: "file", type: 'string', required: true },
    { name: "password", type: 'string', required: false },
    { name: "host", type: 'string', required: false },
    { name: "keyuses", type: 'number', required: false },
  ],
  "vault": [
    { name: "action", type: 'string', required: true, enum: ["seed", "wipekeys", "restorekeys", "passwordlock", "passwordunlock"] },
    { name: "seed", type: 'string', required: false },
    { name: "phrase", type: 'string', required: false },
  ],
  "automine": [
    { name: "enable", type: 'string', required: true, enum: ["true", "false", "single"] },
  ],
  "balance": [
    { name: "address", type: 'string', required: false },
    { name: "tokenid", type: 'string', required: false },
    { name: "confirmations", type: 'string', required: false },
    { name: "megammr", type: 'string', required: false },
  ],
  "block": [],
  "burn": [],
  "capabilities": [],
  "checkaddress": [
    { name: "address", type: 'string', required: true },
  ],
  "checktransactions": [
    { name: "txns", type: 'string', required: true },
  ],
  "coincheck": [
    { name: "data", type: 'string', required: true },
  ],
  "coinnotify": [
    { name: "action", type: 'string', required: true },
    { name: "address", type: 'string', required: true },
  ],
  "coins": [
    { name: "relevant", type: 'boolean', required: false },
    { name: "sendable", type: 'boolean', required: false },
    { name: "coinid", type: 'string', required: false },
    { name: "amount", type: 'string', required: false },
    { name: "address", type: 'string', required: false },
    { name: "tokenid", type: 'string', required: false },
    { name: "coinage", type: 'string', required: false },
    { name: "checkmempool", type: 'string', required: false },
    { name: "order", type: 'string', required: false },
  ],
  "cointrack": [
    { name: "enable", type: 'boolean', required: true, enum: ["true", "false"] },
    { name: "coinid", type: 'string', required: true },
  ],
  "consolidate": [
    { name: "tokenid", type: 'string', required: true },
    { name: "coinage", type: 'string', required: false },
    { name: "maxcoins", type: 'number', required: false },
    { name: "maxsigs", type: 'number', required: false },
    { name: "burn", type: 'string', required: false },
    { name: "debug", type: 'string', required: false },
    { name: "dryrun", type: 'string', required: false },
  ],
  "consolidatefrom": [
    { name: "fromaddress", type: 'string', required: true },
    { name: "address", type: 'string', required: true },
    { name: "amount", type: 'string', required: true },
    { name: "tokenid", type: 'string', required: false },
    { name: "script", type: 'string', required: true },
    { name: "privatekey", type: 'string', required: true },
    { name: "keyuses", type: 'number', required: true },
    { name: "burn", type: 'string', required: false },
    { name: "mine", type: 'string', required: false },
  ],
  "constructfrom": [
    { name: "coinlist", type: 'string', required: true },
    { name: "script", type: 'string', required: true },
    { name: "toaddress", type: 'string', required: true },
    { name: "toamount", type: 'string', required: true },
    { name: "changeaddress", type: 'string', required: true },
    { name: "changeamount", type: 'string', required: true },
    { name: "tokenid", type: 'string', required: false },
  ],
  "convert": [
    { name: "from", type: 'string', required: true },
    { name: "to", type: 'string', required: true },
    { name: "data", type: 'string', required: true },
  ],
  "createfrom": [
    { name: "fromaddress", type: 'string', required: true },
    { name: "address", type: 'string', required: true },
    { name: "amount", type: 'string', required: true },
    { name: "tokenid", type: 'string', required: false },
    { name: "script", type: 'string', required: true },
    { name: "burn", type: 'string', required: false },
  ],
  "debugflag": [
    { name: "activate", type: 'boolean', required: false, enum: ["true", "false"] },
    { name: "var", type: 'string', required: false },
  ],
  "decryptbackup": [
    { name: "file", type: 'string', required: true },
    { name: "password", type: 'string', required: false },
    { name: "output", type: 'string', required: false },
  ],
  "getaddress": [],
  "getaddressinfo": [
    { name: "address", type: 'string', required: true },
  ],
  "getblock": [
    { name: "hash", type: 'string', required: true },
    { name: "height", type: 'number', required: true },
  ],
  "getblockchaininfo": [],
  "getblockcount": [],
  "getblockhash": [
    { name: "height", type: 'number', required: true },
  ],
  "getchaintip": [],
  "getmmrproof": [
    { name: "coinid", type: 'string', required: true },
  ],
  "getmode": [],
  "getnodeinfo": [],
  "getrawtransaction": [
    { name: "txpowid", type: 'string', required: true },
  ],
  "getsupply": [
    { name: "MMR total", type: 'string', required: false },
  ],
  "hash": [
    { name: "data", type: 'string', required: false },
    { name: "file", type: 'string', required: false },
    { name: "type", type: 'string', required: false, enum: ["sha2", "sha3"] },
  ],
  "hashtest": [
    { name: "amount", type: 'string', required: false },
  ],
  "healthcheck": [],
  "help": [
    { name: "command", type: 'string', required: true },
  ],
  "history": [
    { name: "action", type: 'string', required: false },
    { name: "max", type: 'number', required: false },
    { name: "offset", type: 'number', required: false },
    { name: "relevant", type: 'string', required: false },
  ],
  "incentivecash": [
    { name: "uid", type: 'string', required: false },
  ],
  "keys": [
    { name: "action", type: 'string', required: false, enum: ["list", "new", "checkkeys", "genkey"] },
    { name: "publickey", type: 'string', required: false },
  ],
  "logs": [
    { name: "scripts", type: 'string', required: false },
    { name: "mining", type: 'string', required: false },
    { name: "networking", type: 'string', required: false },
    { name: "blocks", type: 'string', required: false },
    { name: "ibd", type: 'string', required: false },
    { name: "txpowdb", type: 'string', required: false },
  ],
  "maths": [
    { name: "calculate", type: 'string', required: true },
    { name: "logs", type: 'string', required: false },
  ],
  "mempool": [
    { name: "minburn", type: 'string', required: true },
    { name: "address", type: 'string', required: true },
    { name: "sort", type: 'string', required: true },
    { name: "page", type: 'number', required: true },
    { name: "pagesize", type: 'number', required: true },
  ],
  "mmrcreate": [
    { name: "nodes", type: 'array', required: true },
  ],
  "mmrproof": [
    { name: "data", type: 'string', required: true },
    { name: "proof", type: 'string', required: true },
    { name: "root", type: 'string', required: true },
  ],
  "multisig": [],
  "multisigread": [],
  "newaddress": [
    { name: "not a default change address", type: 'string', required: false },
  ],
  "newscript": [
    { name: "script", type: 'string', required: true },
    { name: "trackall", type: 'boolean', required: true, enum: ["false", "true"] },
    { name: "clean", type: 'boolean', required: false, enum: ["false", "true"] },
  ],
  "p2pstate": [],
  "postfrom": [
    { name: "data", type: 'string', required: true },
    { name: "mine", type: 'boolean', required: false, enum: ["true", "false"] },
    { name: "mmr", type: 'boolean', required: false, enum: ["true", "false"] },
  ],
  "printmmr": [],
  "printtree": [
    { name: "depth", type: 'number', required: false },
    { name: "cascade", type: 'boolean', required: false, enum: ["true", "false"] },
  ],
  "quit": [
    { name: "compact", type: 'string', required: false },
  ],
  "random": [
    { name: "size", type: 'number', required: false },
    { name: "type", type: 'string', required: false },
  ],
  "rawfrom": [
    { name: "inputs", type: 'string', required: true },
    { name: "outputs", type: 'string', required: true },
    { name: "state", type: 'string', required: false },
  ],
  "removescript": [
    { name: "address", type: 'string', required: true },
  ],
  "rpc": [
    { name: "enable", type: 'string', required: false },
    { name: "ssl", type: 'string', required: false },
    { name: "password", type: 'string', required: false },
  ],
  "runscript": [
    { name: "script", type: 'string', required: true },
    { name: "state", type: 'object', required: false },
    { name: "prevstate", type: 'object', required: false },
    { name: "globals", type: 'object', required: false },
    { name: "signatures", type: 'array', required: false },
    { name: "extrascripts", type: 'object', required: false },
  ],
  "scanchain": [
    { name: "depth", type: 'number', required: false },
  ],
  "scripts": [
    { name: "address", type: 'string', required: false },
  ],
  "seedrandom": [
    { name: "modifier", type: 'string', required: true },
  ],
  "sign": [
    { name: "publickey", type: 'string', required: true },
    { name: "data", type: 'string', required: true },
  ],
  "signfrom": [
    { name: "data", type: 'string', required: true },
    { name: "privatekey", type: 'string', required: true },
    { name: "keyuses", type: 'number', required: true },
  ],
  "slavenode": [],
  "status": [
    { name: "clean", type: 'boolean', required: false },
  ],
  "systemcheck": [],
  "test": [],
  "timemilli": [],
  "tokencreate": [
    { name: "name", type: 'string', required: true },
    { name: "amount", type: 'string', required: true },
    { name: "decimals", type: 'string', required: false },
    { name: "script", type: 'string', required: false },
    { name: "state", type: 'object', required: false },
    { name: "signtoken", type: 'string', required: false },
    { name: "webvalidate", type: 'string', required: false },
    { name: "burn", type: 'string', required: false },
  ],
  "tokens": [
    { name: "tokenid", type: 'string', required: false },
    { name: "action", type: 'string', required: false, enum: ["import", "export"] },
    { name: "data", type: 'string', required: false },
  ],
  "tokenvalidate": [
    { name: "tokenid", type: 'string', required: true },
  ],
  "trace": [
    { name: "enable", type: 'boolean', required: true, enum: ["true", "false"] },
    { name: "filter", type: 'string', required: false },
    { name: "network", type: 'string', required: false },
  ],
  "tutorial": [],
  "txpow": [
    { name: "txpowid", type: 'string', required: false },
    { name: "onchain", type: 'string', required: false },
    { name: "block", type: 'string', required: false },
    { name: "address", type: 'string', required: false },
    { name: "relevant", type: 'string', required: false },
    { name: "max", type: 'number', required: false },
  ],
  "verify": [
    { name: "publickey", type: 'string', required: true },
    { name: "data", type: 'string', required: true },
    { name: "signature", type: 'string', required: true },
  ],
  "webhooks": [
    { name: "action", type: 'string', required: false, enum: ["list", "add", "remove", "clear"] },
    { name: "hook", type: 'string', required: false },
  ],
  "whitepaper": [],
  "mashaddresses": [],
  "mashaddressinfo": [
    { name: "address", type: 'string', required: true },
  ],
  "mashnewaddress": [
    { name: "mode", type: 'string', required: false, enum: ["wallet", "committed-owner-v1"] },
    { name: "state", type: 'string', required: false },
    { name: "trackall", type: 'boolean', required: false, enum: ["false", "true"] },
    { name: "recovery", type: 'array', required: false },
  ],
  "mashretire": [
    { name: "pkroot", type: 'string', required: false },
  ],
  "mashrootstatus": [
    { name: "pkroot", type: 'string', required: false },
  ],
  "mashtxnsign": [
    { name: "id", type: 'string', required: true },
    { name: "mode", type: 'string', required: false, enum: ["wallet", "committed-owner-v1"] },
    { name: "recovery", type: 'array', required: false },
  ],
  "mashtxnverify": [
    { name: "id", type: 'string', required: true },
  ],
  "mashuses": [
    { name: "pkroot", type: 'string', required: false },
  ],
  "connect": [
    { name: "host", type: 'string', required: true },
  ],
  "disconnect": [
    { name: "uid", type: 'string', required: true },
  ],
  "message": [
    { name: "data", type: 'string', required: true },
    { name: "uid", type: 'string', required: false },
  ],
  "network": [
    { name: "action", type: 'string', required: false, enum: ["list", "reset", "recalculateip"] },
  ],
  "nodecount": [
    { name: "file", type: 'string', required: false },
    { name: "complete", type: 'boolean', required: false, enum: ["false", "true"] },
  ],
  "peers": [
    { name: "action", type: 'string', required: false, enum: ["list", "addpeers"] },
    { name: "peerslist", type: 'string', required: false },
    { name: "trust", type: 'string', required: false },
  ],
  "ping": [
    { name: "host", type: 'string', required: true },
  ],
  "send": [
    { name: "address", type: 'string', required: false, enum: ["Mx..", "0x.."] },
    { name: "amount", type: 'string', required: false },
    { name: "multi", type: 'array', required: false },
    { name: "tokenid", type: 'string', required: false },
    { name: "state", type: 'object', required: false },
    { name: "password", type: 'string', required: false },
    { name: "burn", type: 'string', required: false },
    { name: "split", type: 'string', required: false },
    { name: "coinage", type: 'string', required: false },
    { name: "mine", type: 'string', required: false },
    { name: "debug", type: 'string', required: false },
    { name: "dryrun", type: 'string', required: false },
  ],
  "sendfrom": [
    { name: "fromaddress", type: 'string', required: true },
    { name: "address", type: 'string', required: true },
    { name: "amount", type: 'string', required: true },
    { name: "tokenid", type: 'string', required: false },
    { name: "state", type: 'string', required: false },
    { name: "script", type: 'string', required: true },
    { name: "privatekey", type: 'string', required: true },
    { name: "keyuses", type: 'number', required: true },
    { name: "burn", type: 'string', required: false },
    { name: "mine", type: 'string', required: false },
  ],
  "sendnosign": [
    { name: "address", type: 'string', required: false, enum: ["Mx..", "0x.."] },
    { name: "amount", type: 'string', required: false },
    { name: "multi", type: 'array', required: false },
    { name: "tokenid", type: 'string', required: false },
    { name: "state", type: 'object', required: false },
    { name: "burn", type: 'string', required: false },
    { name: "split", type: 'string', required: false },
    { name: "file", type: 'string', required: false },
    { name: "debug", type: 'string', required: false },
  ],
  "sendpoll": [
    { name: "action", type: 'string', required: false, enum: ["add", "list", "remove"] },
    { name: "uid", type: 'string', required: false },
  ],
  "sendpost": [
    { name: "file", type: 'string', required: true },
  ],
  "sendsign": [
    { name: "file", type: 'string', required: true },
  ],
  "sendtransaction": [
    { name: "data", type: 'string', required: true },
  ],
  "sendview": [
    { name: "file", type: 'string', required: true },
  ],
  "txnaddamount": [
    { name: "id", type: 'string', required: true },
    { name: "amount", type: 'string', required: true },
    { name: "address", type: 'string', required: false },
    { name: "onlychange", type: 'string', required: false },
    { name: "tokenid", type: 'string', required: false },
    { name: "burn", type: 'string', required: false },
  ],
  "txnauto": [
    { name: "id", type: 'string', required: true },
    { name: "amount", type: 'string', required: true },
    { name: "address", type: 'string', required: true },
    { name: "tokenid", type: 'string', required: false },
    { name: "sign", type: 'string', required: false },
    { name: "burn", type: 'string', required: false },
    { name: "mmrscript", type: 'string', required: false },
  ],
  "txnbasics": [
    { name: "id", type: 'string', required: true },
  ],
  "txncheck": [
    { name: "id", type: 'string', required: true },
  ],
  "txnclear": [
    { name: "id", type: 'string', required: true },
    { name: "scripts", type: 'string', required: false },
    { name: "mmr", type: 'string', required: false },
    { name: "signatures", type: 'string', required: false },
  ],
  "txncoinlock": [
    { name: "action", type: 'string', required: false },
  ],
  "txncreate": [
    { name: "id", type: 'string', required: true },
  ],
  "txndelete": [
    { name: "id", type: 'string', required: true },
  ],
  "txnexport": [
    { name: "id", type: 'string', required: true },
    { name: "file", type: 'string', required: false },
  ],
  "txnimport": [
    { name: "id", type: 'string', required: false },
    { name: "file", type: 'string', required: false },
    { name: "data", type: 'string', required: false },
  ],
  "txninput": [
    { name: "id", type: 'string', required: true },
    { name: "coinid", type: 'string', required: false },
    { name: "coindata", type: 'string', required: false },
    { name: "floating", type: 'string', required: false },
    { name: "address", type: 'string', required: false },
    { name: "amount", type: 'string', required: false },
    { name: "tokenid", type: 'string', required: false },
    { name: "scriptmmr", type: 'boolean', required: false },
  ],
  "txnlist": [
    { name: "id", type: 'string', required: false },
    { name: "transactiononly", type: 'string', required: false },
  ],
  "txnlock": [
    { name: "action", type: 'string', required: false },
    { name: "timeout", type: 'number', required: false },
    { name: "unlockdelay", type: 'number', required: false },
  ],
  "txnmine": [
    { name: "id", type: 'string', required: false },
    { name: "data", type: 'string', required: false },
  ],
  "txnminepost": [
    { name: "data", type: 'string', required: true },
  ],
  "txnmmr": [
    { name: "id", type: 'string', required: true },
  ],
  "txnoutput": [
    { name: "id", type: 'string', required: true },
    { name: "amount", type: 'string', required: true },
    { name: "address", type: 'string', required: true },
    { name: "tokenid", type: 'string', required: false },
    { name: "storestate", type: 'string', required: false },
  ],
  "txnpost": [
    { name: "id", type: 'string', required: true },
    { name: "auto", type: 'boolean', required: false },
    { name: "burn", type: 'string', required: false },
    { name: "mine", type: 'string', required: false },
    { name: "txndelete", type: 'string', required: false },
  ],
  "txnscript": [
    { name: "id", type: 'string', required: true },
    { name: "auto", type: 'boolean', required: false },
    { name: "scripts", type: 'object', required: false },
  ],
  "txnsign": [
    { name: "id", type: 'string', required: true },
    { name: "publickey", type: 'string', required: true, enum: ["0x..", "auto"] },
    { name: "txnpostauto", type: 'string', required: false },
    { name: "txnpostburn", type: 'string', required: false },
    { name: "txnpostmine", type: 'string', required: false },
    { name: "txndelete", type: 'string', required: false },
  ],
  "txnstate": [
    { name: "id", type: 'string', required: true },
    { name: "port", type: 'number', required: true },
    { name: "value", type: 'string', required: true },
  ],
  "txnview": [
    { name: "file", type: 'string', required: false },
    { name: "data", type: 'string', required: false },
  ],
} as const satisfies Record<string, readonly MinimaCommandParam[]>;

export const MINIMA_COMMAND_NAMES: readonly string[] = Object.freeze(
  Object.keys(MINIMA_COMMAND_PARAMS),
);
