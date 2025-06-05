"use strict";
// src/modules/common/RedisGameStateStore.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisGameStateStore = void 0;
const redis_1 = __importDefault(require("../../../../common/config/redis"));
class RedisGameStateStore {
    constructor() { }
    /** Singleton accessor */
    static getInstance() {
        if (!RedisGameStateStore._instance) {
            RedisGameStateStore._instance = new RedisGameStateStore();
        }
        return RedisGameStateStore._instance;
    }
    /** Build the Redis hash key */
    key(gameId, playerId) {
        return `game:${gameId}:user:${playerId}:state`;
    }
    /** Ensure we have a connected client */
    getClient() {
        const client = redis_1.default.getInstance().getClient();
        if (!client) {
            throw new Error("Redis client not connected—make sure you’ve called `.connect()` on RedisService first.");
        }
        return client;
    }
    /** Load + merge */
    async load(gameId, playerId, defaults) {
        const client = this.getClient();
        const data = await client.hGetAll(this.key(gameId, playerId));
        if (Object.keys(data).length === 0) {
            return { ...defaults };
        }
        const state = { ...defaults };
        for (const [field, raw] of Object.entries(data)) {
            if (raw === "1" || raw === "0") {
                state[field] = raw === "1";
            }
            else {
                try {
                    state[field] = JSON.parse(raw);
                }
                catch {
                    const num = Number(raw);
                    state[field] = isNaN(num) ? raw : num;
                }
            }
        }
        return state;
    }
    /** Save only the changed fields */
    async save(gameId, playerId, delta, ttlSeconds = 60 * 60 * 24) {
        const client = this.getClient();
        const multi = client.multi();
        for (const [field, value] of Object.entries(delta)) {
            if (value === undefined)
                continue;
            let str;
            if (typeof value === "boolean") {
                str = value ? "1" : "0";
            }
            else if (Array.isArray(value) || typeof value === "object") {
                str = JSON.stringify(value);
            }
            else {
                str = String(value);
            }
            multi.hSet(this.key(gameId, playerId), field, str);
        }
        multi.expire(this.key(gameId, playerId), ttlSeconds);
        await multi.exec();
    }
}
exports.RedisGameStateStore = RedisGameStateStore;
