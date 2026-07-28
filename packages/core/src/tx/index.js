"use strict";
/**
 * @module @totemsdk/core/tx
 * Transaction service and lifecycle management
 *
 * This module provides:
 * - TransactionService: WOTS signing flow (prepare → sign → finalize)
 * - TransactionLifecycle: Orchestrates flow with lease/watermark stores
 * - TransactionReceiptStore: Persistent transaction history
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionReceiptStore = exports.WatermarkExhaustedError = exports.TransactionLifecycleError = exports.TransactionLifecycle = exports.TransactionService = void 0;
var TransactionService_1 = require("./TransactionService");
Object.defineProperty(exports, "TransactionService", { enumerable: true, get: function () { return TransactionService_1.TransactionService; } });
var TransactionLifecycle_1 = require("./TransactionLifecycle");
Object.defineProperty(exports, "TransactionLifecycle", { enumerable: true, get: function () { return TransactionLifecycle_1.TransactionLifecycle; } });
Object.defineProperty(exports, "TransactionLifecycleError", { enumerable: true, get: function () { return TransactionLifecycle_1.TransactionLifecycleError; } });
Object.defineProperty(exports, "WatermarkExhaustedError", { enumerable: true, get: function () { return TransactionLifecycle_1.WatermarkExhaustedError; } });
var TransactionReceiptStore_1 = require("./TransactionReceiptStore");
Object.defineProperty(exports, "TransactionReceiptStore", { enumerable: true, get: function () { return TransactionReceiptStore_1.TransactionReceiptStore; } });
