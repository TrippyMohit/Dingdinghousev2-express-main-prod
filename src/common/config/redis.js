"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("redis");
const events_1 = require("events");
const config_1 = require("./config");
events_1.EventEmitter.defaultMaxListeners = 20;
class RedisService {
    constructor() {
        this.client = null;
        this.pubClient = null;
        this.subClient = null;
        this.connectionUrl = config_1.config.redis.url;
    }
    static getInstance() {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }
    async connect() {
        if (this.client)
            return;
        try {
            this.client = (0, redis_1.createClient)({
                url: this.connectionUrl,
                socket: {
                    reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
                },
            });
            this.client.on("ready", () => console.log("Redis Client Ready"));
            this.client.on("connect", () => console.log("Redis Client Connected"));
            this.client.on("reconnecting", () => console.log("Redis Client Reconnecting"));
            this.client.on("end", () => console.log("Redis Client Connection Closed"));
            await this.client.connect();
            await this.createPubSubClients();
        }
        catch (error) {
            console.error("Failed to connect to Redis:", error);
            throw error;
        }
    }
    async createPubSubClients() {
        try {
            this.pubClient = this.client.duplicate();
            this.subClient = this.client.duplicate();
            await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
            console.log("Redis Pub/Sub clients connected");
        }
        catch (error) {
            console.error("Failed to create pub/sub clients:", error);
            throw error;
        }
    }
    // Core Methods
    getClient() {
        if (!this.client)
            throw new Error("Redis client not connected");
        return this.client;
    }
    getPublisher() {
        if (!this.pubClient)
            throw new Error("Redis publisher not connected");
        return this.pubClient;
    }
    getSubscriber() {
        if (!this.subClient)
            throw new Error("Redis subscriber not connected");
        return this.subClient;
    }
    // Key-Value Operations
    async set(key, value, ttl) {
        const client = this.getClient();
        const val = typeof value === "string" ? value : JSON.stringify(value);
        await (ttl ? client.set(key, val, { EX: ttl }) : client.set(key, val));
    }
    async get(key) {
        return this.getClient().get(key);
    }
    async getJSON(key) {
        const val = await this.get(key);
        return val ? JSON.parse(val) : null;
    }
    async setJSON(key, value, ttl) {
        await this.set(key, JSON.stringify(value), ttl);
    }
    async del(key) {
        return this.getClient().del(key);
    }
    async exists(key) {
        return (await this.getClient().exists(key)) === 1;
    }
    async expire(key, seconds) {
        return await this.getClient().expire(key, seconds);
    }
    async ttl(key) {
        return this.getClient().ttl(key);
    }
    // Lock Management
    async acquireLock(key, ttl = 60) {
        try {
            const client = this.getClient();
            const lockValue = Date.now().toString(); // Use timestamp as lock value for debugging
            const result = await client.set(key, lockValue, {
                NX: true,
                EX: ttl,
            });
            const success = result === "OK";
            if (!success) {
                // Check remaining TTL for debugging
                const remainingTtl = await client.ttl(key);
                // console.log(`Existing lock ${key} has ${remainingTtl}s remaining`);
            }
            return success;
        }
        catch (error) {
            console.error(`Error acquiring lock for ${key}:`, error);
            return false;
        }
    }
    async releaseLock(key) {
        try {
            const exists = await this.exists(key);
            if (!exists) {
                // console.log(`Lock ${key} already released or expired`);
                return;
            }
            const released = await this.del(key);
        }
        catch (error) {
            console.error(`Error releasing lock for ${key}:`, error);
        }
    }
    async withLock(key, callback, ttl = 60, // Increased from 30 to 60 seconds for complex operations
    retries = 8, // Increased from 5 to 8
    delay = 300 // Increased from 200 to 300ms
    ) {
        const lockKey = `redis_lock:${key}`;
        let lastError = null;
        for (let i = 0; i < retries; i++) {
            try {
                if (await this.acquireLock(lockKey, ttl)) {
                    try {
                        // console.log(`Lock acquired for ${lockKey}, executing callback...`);
                        const startTime = Date.now();
                        const result = await callback();
                        const duration = Date.now() - startTime;
                        // console.log(`Callback for ${lockKey} completed in ${duration}ms`);
                        await this.releaseLock(lockKey);
                        // console.log(`Lock released for ${lockKey}`);
                        return result;
                    }
                    catch (err) {
                        console.error(`Error during locked operation for ${lockKey}:`, err);
                        await this.releaseLock(lockKey);
                        throw err;
                    }
                }
                if (i < retries - 1) {
                    // Add jitter to the delay to prevent synchronized retries
                    const jitteredDelay = delay + Math.floor(Math.random() * 200);
                    console.log(`Retry ${i + 1}/${retries} for lock ${lockKey} after ${jitteredDelay}ms`);
                    await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
                }
                else {
                    lastError = new Error(`Failed to acquire lock after ${retries} attempts for key: ${lockKey}`);
                }
            }
            catch (error) {
                console.error(`Unexpected error in withLock for ${lockKey}:`, error);
                lastError = error instanceof Error ? error : new Error(String(error));
                // If this was an error in acquiring/releasing the lock, we should retry
                if (i < retries - 1) {
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
        // If we got here, all retries failed
        throw lastError || new Error(`Failed to acquire lock for key: ${lockKey}`);
    }
    // Hash Operations
    async hSet(key, field, value) {
        return this.getClient().hSet(key, field, value);
    }
    async hGet(key, field) {
        const val = await this.getClient().hGet(key, field);
        return val ?? null;
    }
    async hGetAll(key) {
        return this.getClient().hGetAll(key);
    }
    async hDel(key, ...fields) {
        return this.getClient().hDel(key, fields);
    }
    // List Operations
    async lPush(key, ...values) {
        return this.getClient().lPush(key, values);
    }
    async rPush(key, ...values) {
        return this.getClient().rPush(key, values);
    }
    async lPop(key) {
        return this.getClient().lPop(key);
    }
    async rPop(key) {
        return this.getClient().rPop(key);
    }
    // Set Operations
    async sAdd(key, ...members) {
        return this.getClient().sAdd(key, members);
    }
    async sRem(key, ...members) {
        return this.getClient().sRem(key, members);
    }
    async sIsMember(key, member) {
        return await this.getClient().sIsMember(key, member);
    }
    // Pub/Sub
    async publish(channel, message) {
        const msg = typeof message === "string" ? message : JSON.stringify(message);
        return this.getPublisher().publish(channel, msg);
    }
    async subscribe(channel, callback) {
        await this.getSubscriber().subscribe(channel, callback);
    }
    async unsubscribe(channel) {
        if (!this.subClient)
            throw new Error("Redis subscriber not connected");
        await this.subClient.unsubscribe(channel);
    }
    // Utility Methods
    async keys(pattern) {
        return this.getClient().keys(pattern);
    }
    async flushAll(async = true) {
        await this.getClient().flushAll(async ? redis_1.RedisFlushModes.ASYNC : redis_1.RedisFlushModes.SYNC);
    }
    async info(section) {
        return section ? this.getClient().info(section) : this.getClient().info();
    }
    async disconnect() {
        try {
            await Promise.all([
                this.subClient?.quit(),
                this.pubClient?.quit(),
                this.client?.quit(),
            ]);
            this.subClient = null;
            this.pubClient = null;
            this.client = null;
            console.log("Redis connections closed");
        }
        catch (error) {
            console.error("Error disconnecting from Redis:", error);
            throw error;
        }
    }
}
exports.default = RedisService;
