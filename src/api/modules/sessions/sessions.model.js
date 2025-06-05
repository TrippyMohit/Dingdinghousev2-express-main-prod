"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpinModel = exports.GameSessionModel = exports.PlatformSessionModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PlatformSessionSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.default.Types.ObjectId,
        ref: "User",
        required: true
    },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    isActive: { type: Boolean, required: true, default: true },
    initialBalance: { type: Number, required: true },
    finalBalance: { type: Number, default: null },
    gameSessions: {
        type: [mongoose_1.default.Types.ObjectId],
        ref: "GameSession",
        default: []
    }
}, { timestamps: true });
const GameSessionSchema = new mongoose_1.Schema({
    platformSessionId: {
        type: mongoose_1.default.Types.ObjectId,
        ref: "PlatformSession",
        required: true
    },
    userId: {
        type: mongoose_1.default.Types.ObjectId,
        ref: "User",
        required: true
    },
    gameId: {
        type: mongoose_1.default.Types.ObjectId,
        ref: "Game",
        required: true
    },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    isActive: { type: Boolean, required: true, default: true },
    initialBalance: { type: Number, required: true },
    finalBalance: { type: Number, default: null }
}, { timestamps: true });
const SpinSchema = new mongoose_1.Schema({
    gameSessionId: {
        type: mongoose_1.default.Types.ObjectId,
        ref: "GameSession",
        required: true
    },
    betAmount: { type: Number, required: true },
    winAmount: { type: Number, required: true },
    bonus: {
        count: { type: Number, default: 0 },
        winAmount: { type: Number, default: 0 }
    },
    scatter: {
        count: { type: Number, default: 0 },
        winAmount: { type: Number, default: 0 }
    },
    jackpot: {
        count: { type: Number, default: 0 },
        winAmount: { type: Number, default: 0 }
    }
}, { timestamps: true });
const PlatformSessionModel = mongoose_1.default.model("PlatformSession", PlatformSessionSchema);
exports.PlatformSessionModel = PlatformSessionModel;
const GameSessionModel = mongoose_1.default.model("GameSession", GameSessionSchema);
exports.GameSessionModel = GameSessionModel;
const SpinModel = mongoose_1.default.model("Spin", SpinSchema);
exports.SpinModel = SpinModel;
