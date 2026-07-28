"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bytesToHex = void 0;
const bytesToHex = (b) => "0x" + [...b].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
exports.bytesToHex = bytesToHex;
