"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSpin = processSpin;
const config_1 = require("./config");
const engine_1 = require("./engine");
const RedisGameStateStore_1 = require("../../common/RedisGameStateStore");
// Grab the singleton store, typing it for your PlayerGameState
const stateStore = RedisGameStateStore_1.RedisGameStateStore.getInstance();
async function processSpin(playerId, bet, rng) {
    // 1) Define your default state inline (or import from a constants file)
    const defaults = {
        isFreeSpin: false,
        isTriggered: false,
        freeSpinCount: 0,
        featureAll: false,
        goldWildCols: [],
        currentWining: 0,
        totalBet: 0,
        haveWon: 0,
        balance: 0,
    };
    // 2) Load + merge
    const state = await stateStore.load(config_1.gameDefinition.id, playerId, defaults);
    // 3) Do your spin
    const ctx = { playerId, bet, rng };
    const result = (0, engine_1.spin)(config_1.gameDefinition, ctx, state);
    // 4) Save only the delta back into Redis
    await stateStore.save(config_1.gameDefinition.id, playerId, result.deltaState);
    return result;
}
