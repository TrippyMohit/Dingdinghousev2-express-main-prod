"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const game_schema_1 = __importDefault(require("../../../common/schemas/game.schema"));
const game_type_1 = require("../../../common/types/game.type");
const redis_1 = __importDefault(require("../../../common/config/redis"));
const playground_state_1 = require("./playground.state");
const game_manager_1 = require("../../games/game.manager");
class PlaygroundService {
    constructor() {
        this.redisService = redis_1.default.getInstance();
        this.state = playground_state_1.StateService.getInstance();
        this.gameManager = game_manager_1.GameManager.getInstance();
    }
    static getInstance() {
        if (!PlaygroundService.instance) {
            PlaygroundService.instance = new PlaygroundService();
        }
        return PlaygroundService.instance;
    }
    async initialize(gameId, userId) {
        // Get game with payout configuration
        const game = await this.getGameWithPayout(gameId);
        if (!game || !game.payout) {
            throw new Error("Game configuration not found");
        }
        // Initialize game engine
        const engine = await this.gameManager.getGameEngine(game);
        // Initialize player state
        const state = await this.state.initialize(userId, gameId);
        return { engine, state };
    }
    async reinitialize(gameId, newConfig) {
        if (!newConfig) {
            throw new Error("New configuration is required");
        }
        const game = await this.getGameWithPayout(gameId);
        if (!game || !game.payout) {
            throw new Error("Game not found");
        }
        const gameData = {
            _id: game._id,
            tag: game.tag,
            payout: {
                _id: game.payout._id,
                gameId: game.payout.gameId,
                name: game.payout.name,
                version: game.payout.version,
                isActive: game.payout.isActive,
                tag: game.tag,
                content: {
                    ...game.payout.content,
                    ...newConfig,
                },
                createdAt: game.payout.createdAt,
                updatedAt: new Date(),
            },
        };
        console.log("updated game data ; ");
        console.dir(gameData, { depth: null });
        // Update existing engine config instead of creating new instance
        const updatedEngine = this.gameManager.updateGameConfig(gameData);
        if (!updatedEngine) {
            throw new Error("Failed to update game configuration");
        }
        return updatedEngine;
    }
    async getGameWithPayout(gameId) {
        return game_schema_1.default.findOne({
            _id: gameId,
            status: { $ne: game_type_1.GameStatus.DELETED },
        })
            .populate("payout")
            .lean()
            .exec();
    }
    async validateToken(token) {
        try {
            // Get the token data from redis
            const key = `game:token:${token}`;
            const data = await this.redisService.getJSON(key);
            // If no token data found, return null
            if (!data) {
                return null;
            }
            return data;
        }
        catch (error) {
            console.error("Error validating game token:", error);
            throw error;
        }
    }
}
exports.default = PlaygroundService;
