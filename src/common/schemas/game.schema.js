"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const game_type_1 = require("../types/game.type");
const GameSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    thumbnail: { type: String, required: false },
    url: { type: String, required: true },
    type: { type: String, required: true },
    category: { type: String },
    status: { type: String, enum: Object.values(game_type_1.GameStatus), default: game_type_1.GameStatus.ACTIVE },
    tag: { type: String, required: true, unique: true },
    slug: { type: String },
    order: { type: Number },
    payout: { type: mongoose_1.Types.ObjectId, ref: "Payout", required: false }
}, { timestamps: true });
GameSchema.index({ status: 1 });
GameSchema.index({ order: 1 });
const Game = (0, mongoose_1.model)("Game", GameSchema);
exports.default = Game;
