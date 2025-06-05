"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = void 0;
const playground_state_1 = require("../../realtime/gateways/playground/playground.state");
class GameEngine {
    constructor(game) {
        this.state = playground_state_1.StateService.getInstance();
        this.config = this.createConfig(game);
        this.validateConfig();
    }
    createConfig(game) {
        if (!game.payout)
            throw new Error("Game payout configuration required");
        return {
            gameId: game.payout.gameId.toString(),
            name: game.payout.name,
            version: game.payout.version,
            tag: game.tag,
            content: typeof game.payout.content === "string"
                ? JSON.parse(game.payout.content)
                : game.payout.content,
        };
    }
    updateConfig(game) {
        this.config = this.createConfig(game);
    }
    getConfig() {
        return {
            gameId: this.config.gameId,
            name: this.config.name,
            version: this.config.version,
            tag: this.config.tag,
            content: this.config.content,
        };
    }
    async getPlayerState(userId) {
        return this.state.getState(userId, this.config.gameId);
    }
    async updatePlayerState(userId, updates) {
        return this.state.updatePlayerState(userId, this.config.gameId, updates);
    }
}
exports.GameEngine = GameEngine;
