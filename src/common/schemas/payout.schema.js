"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const PayoutSchema = new mongoose_1.Schema({
    gameId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Game",
        required: true,
        index: true
    },
    name: { type: String, required: true },
    version: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: false },
    content: { type: mongoose_1.Schema.Types.Mixed, required: true }
}, { timestamps: true });
PayoutSchema.index({ gameId: 1, version: 1 }, { unique: true }); // Compound index for gameId and version
PayoutSchema.index({ gameId: 1, isActive: 1 }); // Index for active payouts
const Payout = (0, mongoose_1.model)("Payout", PayoutSchema);
exports.default = Payout;
