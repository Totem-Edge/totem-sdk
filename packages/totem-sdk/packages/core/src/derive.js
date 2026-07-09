"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scriptToAddress = scriptToAddress;
exports.addressToRoot = addressToRoot;
const mmr_1 = require("./mmr");
const minima32_1 = require("./minima32");
function scriptToAddress(script) {
    const root32 = (0, mmr_1.mmrRootFromSingleLeaf)(script); // raw 32 bytes
    return (0, minima32_1.encodeMx)(root32); // builds sentinel+len+checksum
}
function addressToRoot(mx) {
    return (0, minima32_1.decodeMx)(mx); // returns the same raw 32 bytes, validates checksum/frame
}
