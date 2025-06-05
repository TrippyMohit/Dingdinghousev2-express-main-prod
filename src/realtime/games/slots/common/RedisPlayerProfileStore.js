"use strict";
// src/modules/common/RedisPlayerProfileStore.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisPlayerProfileStore = void 0;
const redis_1 = __importDefault(require("../../../../common/config/redis"));
class RedisPlayerProfileStore {
    constructor() {
        this.client = redis_1.default.getInstance().getClient();
        this.prefix = "player";
    }
    makeKey(playerId) {
        return `${this.prefix}:${playerId}:profile`;
    }
    async load(playerId) {
        const key = this.makeKey(playerId);
        const data = await this.client.hGetAll(key);
        return {
            balance: Number(data.balance) || 0,
            credits: Number(data.credits) || 0,
        };
    }
    async save(playerId, delta) {
        const key = this.makeKey(playerId);
        const multi = this.client.multi();
        if (delta.balance !== undefined) {
            multi.hSet(key, "balance", String(delta.balance));
        }
        if (delta.credits !== undefined) {
            multi.hSet(key, "credits", String(delta.credits));
        }
        // keep around one week
        multi.expire(key, 60 * 60 * 24 * 7);
        await multi.exec();
    }
}
exports.RedisPlayerProfileStore = RedisPlayerProfileStore;
