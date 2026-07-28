"use strict";
/**
 * @module @totemsdk/core/lease
 * WOTS lease lifecycle management
 *
 * This module provides:
 * - LeaseStore: Persistent storage for lease records with in-memory cache
 * - WatermarkStore: WOTS index tracking with server sync
 * - LeaseMonitor: Expiry monitoring and renewal
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.flatIndexFromLanes = exports.finalizeLease = exports.prepareLease = exports.LeaseMonitor = exports.WatermarkStore = exports.LeaseStore = void 0;
var LeaseStore_1 = require("./LeaseStore");
Object.defineProperty(exports, "LeaseStore", { enumerable: true, get: function () { return LeaseStore_1.LeaseStore; } });
var WatermarkStore_1 = require("./WatermarkStore");
Object.defineProperty(exports, "WatermarkStore", { enumerable: true, get: function () { return WatermarkStore_1.WatermarkStore; } });
var LeaseMonitor_1 = require("./LeaseMonitor");
Object.defineProperty(exports, "LeaseMonitor", { enumerable: true, get: function () { return LeaseMonitor_1.LeaseMonitor; } });
var lease_client_1 = require("../lease-client");
Object.defineProperty(exports, "prepareLease", { enumerable: true, get: function () { return lease_client_1.prepareLease; } });
Object.defineProperty(exports, "finalizeLease", { enumerable: true, get: function () { return lease_client_1.finalizeLease; } });
Object.defineProperty(exports, "flatIndexFromLanes", { enumerable: true, get: function () { return lease_client_1.flatIndexFromLanes; } });
