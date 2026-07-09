"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WOTS_V2_SPEC = exports.WOTS_V1_DEV = exports.WOTS_MINIMA = void 0;
exports.getParamSet = getParamSet;
exports.WOTS_MINIMA = {
    name: 'minima',
    n: 256,
    w: 8,
    L: 34,
    messageSize: 32,
    checksumSize: 14,
    checksumDigits: 2,
    maxDigit: 255,
};
// Legacy aliases for backwards compatibility during migration
exports.WOTS_V1_DEV = exports.WOTS_MINIMA;
exports.WOTS_V2_SPEC = exports.WOTS_MINIMA;
function getParamSet(_env) {
    return exports.WOTS_MINIMA;
}
