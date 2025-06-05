"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateService = void 0;
const mongoose_1 = require("mongoose");
const redis_1 = __importDefault(require("../../../common/config/redis"));
const user_schema_1 = __importDefault(require("../../../common/schemas/user.schema"));
class StateService {
    constructor() {
        this.STATE_TTL = 86400; // 24 hours in seconds
        this.DECIMAL_PRECISION = 4; // Specify decimal precision
        this.redisService = redis_1.default.getInstance();
    }
    static getInstance() {
        if (!StateService.instance) {
            StateService.instance = new StateService();
        }
        return StateService.instance;
    }
    // Helper method to format balance with precision
    formatBalance(balance) {
        return Number(balance.toFixed(this.DECIMAL_PRECISION));
    }
    // ================= Core State Management =================
    getStateKey(userId, gameId) {
        return `player:${userId}:game:${gameId}:state`;
    }
    getLockKey(userId, gameId) {
        return `player:${userId}:game:${gameId}:state:lock`;
    }
    /**
     * Public method to use Redis lock with a custom key - makes locks available for other services
     * Fixed to use more consistent lock naming and avoid double prefixing
     */
    async withLock(key, callback, ttl = 60 // Increased from 30 to 60 seconds
    ) {
        // Make sure we don't double-prefix lock keys
        const lockKey = key.startsWith("lock:") ? key : `lock:${key}`;
        const redis = redis_1.default.getInstance();
        return redis.withLock(lockKey, callback, ttl);
    }
    async initialize(userId, gameId) {
        const key = this.getStateKey(userId, gameId);
        const existing = await this.getState(userId, gameId);
        if (existing)
            return existing;
        // Use a lock when initializing state to prevent duplicate creation
        return this.withLock(`initialize:${userId}:${gameId}`, async () => {
            // Check again inside the lock to ensure no race condition
            const checkAgain = await this.getState(userId, gameId);
            if (checkAgain)
                return checkAgain;
            // Get user with balance information
            const user = await user_schema_1.default.findById(userId)
                .select("username balance role status createdBy path")
                .lean();
            if (!user) {
                throw new Error("User not found");
            }
            // Ensure balance is a number and properly initialized with precision
            const rawBalance = typeof user.balance === "number" ? user.balance : 0;
            const balance = this.formatBalance(rawBalance);
            console.log("Initializing player state with balance:", balance);
            const initialState = {
                balance: balance, // Use the formatted balance with proper precision
                lastUpdated: new Date(),
                sessionStart: new Date(),
                currentWinning: 0,
                gameSpecific: {},
                userInfo: {
                    username: user.username,
                    role: user.role instanceof mongoose_1.Types.ObjectId
                        ? user.role
                        : user.role?.toString(),
                    status: user.status,
                    createdBy: user.createdBy,
                    path: user.path?.toString(),
                },
            };
            // Log the state being saved
            console.log("Saving initial player state:", initialState);
            await this.redisService.setJSON(key, initialState, this.STATE_TTL);
            // Verify the saved state
            const savedState = await this.getState(userId, gameId);
            console.log("Verified saved state:", savedState);
            return initialState;
        });
    }
    async getUserInfo(userId, gameId) {
        const state = await this.getState(userId, gameId);
        return state?.userInfo || null;
    }
    async syncBalanceToDatabase(userId, gameId) {
        const state = await this.getState(userId, gameId);
        if (!state)
            return;
        // No need to lock for DB sync, we're just reading current state
        await user_schema_1.default.findByIdAndUpdate(userId, {
            balance: state.balance,
        });
    }
    async deductBalanceWithDbSync(userId, gameId, amount) {
        // Format the amount with proper precision
        const formattedAmount = this.formatBalance(amount);
        // Use a single lock for the entire operation
        return this.withLock(this.getLockKey(userId, gameId), async () => {
            const result = await this.deductBalance(userId, gameId, formattedAmount, false);
            if (result.success) {
                await user_schema_1.default.findByIdAndUpdate(userId, {
                    balance: result.newBalance,
                });
            }
            return result;
        });
    }
    async creditBalanceWithDbSync(userId, gameId, amount) {
        // Format the amount with proper precision
        const formattedAmount = this.formatBalance(amount);
        // Use a single lock for the entire operation
        return this.withLock(this.getLockKey(userId, gameId), async () => {
            const newBalance = await this.creditBalance(userId, gameId, formattedAmount, false);
            await user_schema_1.default.findByIdAndUpdate(userId, {
                balance: newBalance,
            });
            return newBalance;
        });
    }
    async getState(userId, gameId) {
        const key = this.getStateKey(userId, gameId);
        return this.redisService.getJSON(key);
    }
    async updatePlayerState(userId, gameId, updates, useLock = true) {
        const key = this.getStateKey(userId, gameId);
        // Format balance if it exists in updates
        if (updates.balance !== undefined) {
            updates.balance = this.formatBalance(updates.balance);
        }
        const updateFunc = async () => {
            const currentState = (await this.getState(userId, gameId)) ||
                (await this.initialize(userId, gameId));
            const updatedState = {
                ...currentState,
                ...updates,
                lastUpdated: new Date(),
            };
            await this.redisService.setJSON(key, updatedState, this.STATE_TTL);
            return updatedState;
        };
        if (useLock) {
            return this.withLock(this.getLockKey(userId, gameId), updateFunc);
        }
        else {
            return updateFunc();
        }
    }
    // ================= New State Methods =================
    /**
     * Always returns a state (initializes with defaults if missing)
     * Eliminates null checks in downstream code
     */
    async getSafeState(userId, gameId) {
        return (await this.getState(userId, gameId)) || this.initialize(userId, gameId);
    }
    /**
     * Partial update optimized for Redis operations
     * Uses delta changes instead of full state replacement
     */
    async updatePartialState(userId, gameId, delta) {
        const key = this.getStateKey(userId, gameId);
        // Format balance if present in delta
        if (delta.balance !== undefined) {
            delta.balance = this.formatBalance(delta.balance);
        }
        return this.withLock(this.getLockKey(userId, gameId), async () => {
            const currentState = await this.getSafeState(userId, gameId);
            // Merge changes
            const updatedState = {
                ...currentState,
                ...delta,
                lastUpdated: new Date(),
            };
            // Optimized Redis operation - merge rather than replace
            await this.redisService.setJSON(key, updatedState, this.STATE_TTL);
            return updatedState;
        });
    }
    // ================= Balance Operations =================
    async getBalance(userId, gameId) {
        const state = await this.getState(userId, gameId);
        return state?.balance ?? 0; // Added null coalescing to return 0 if state is null
    }
    async deductBalance(userId, gameId, amount, useLock = true) {
        if (amount <= 0) {
            throw new Error("Deduction amount must be positive");
        }
        // Format the amount with proper precision
        const formattedAmount = this.formatBalance(amount);
        const deductFunc = async () => {
            const state = (await this.getState(userId, gameId)) ||
                (await this.initialize(userId, gameId));
            if (state.balance < formattedAmount) {
                return { success: false, newBalance: state.balance };
            }
            const newBalance = this.formatBalance(state.balance - formattedAmount);
            await this.updatePlayerState(userId, gameId, {
                balance: newBalance,
                currentBet: formattedAmount, // Optionally track last bet
            }, false // Don't use another lock since we're already in one
            );
            return { success: true, newBalance };
        };
        if (useLock) {
            return this.withLock(this.getLockKey(userId, gameId), deductFunc);
        }
        else {
            return deductFunc();
        }
    }
    async creditBalance(userId, gameId, amount, useLock = true) {
        if (amount <= 0) {
            throw new Error("Credit amount must be positive");
        }
        // Format the amount with proper precision
        const formattedAmount = this.formatBalance(amount);
        const creditFunc = async () => {
            const state = (await this.getState(userId, gameId)) ||
                (await this.initialize(userId, gameId));
            const newBalance = this.formatBalance(state.balance + formattedAmount);
            await this.updatePlayerState(userId, gameId, { balance: newBalance }, false // Don't use another lock since we're already in one
            );
            return newBalance;
        };
        if (useLock) {
            return this.withLock(this.getLockKey(userId, gameId), creditFunc);
        }
        else {
            return creditFunc();
        }
    }
    // ================= Game-Specific State =================
    async getGameSpecificState(userId, gameId, key) {
        const state = await this.getState(userId, gameId);
        return state?.gameSpecific?.[key];
    }
    async setGameSpecificState(userId, gameId, key, value) {
        await this.withLock(this.getLockKey(userId, gameId), async () => {
            const state = (await this.getState(userId, gameId)) ||
                (await this.initialize(userId, gameId));
            const updatedGameSpecific = {
                ...state.gameSpecific,
                [key]: value,
            };
            await this.updatePlayerState(userId, gameId, {
                gameSpecific: updatedGameSpecific,
            }, false // Don't use another lock since we're already in one
            );
        });
    }
    // ================= Session Management =================
    async endSession(userId, gameId) {
        // Could save session data to DB before clearing if needed
        const key = this.getStateKey(userId, gameId);
        await this.redisService.del(key);
    }
    async getSessionDuration(userId, gameId) {
        const state = await this.getState(userId, gameId);
        if (!state)
            return 0;
        // Handle potential Date object serialization issues
        const sessionStart = state.sessionStart instanceof Date
            ? state.sessionStart
            : new Date(state.sessionStart);
        return (new Date().getTime() - sessionStart.getTime()) / 1000;
    }
}
exports.StateService = StateService;
