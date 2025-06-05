"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSEClientManager = exports.SSE_REDIS_CHANNEL = exports.SSEEventTypes = void 0;
exports.publishToSSE = publishToSSE;
exports.publishToUser = publishToUser;
const redis_1 = __importDefault(require("../config/redis"));
// SSE Event Types
var SSEEventTypes;
(function (SSEEventTypes) {
    SSEEventTypes["USER_CONNECTED"] = "user-connected";
    SSEEventTypes["USER_DISCONNECTED"] = "user-disconnected";
    SSEEventTypes["GAME_STARTED"] = "game-started";
    SSEEventTypes["GAME_ENDED"] = "game-ended";
})(SSEEventTypes || (exports.SSEEventTypes = SSEEventTypes = {}));
// Redis Channels
exports.SSE_REDIS_CHANNEL = "sse-events";
// SSE Client Manager
class SSEClientManager {
    constructor() {
        this.clients = new Map();
        this.userSubscriptions = new Set();
        this.redisService = redis_1.default.getInstance();
        this.initGlobalSubscription();
    }
    static getInstance() {
        if (!SSEClientManager.instance) {
            SSEClientManager.instance = new SSEClientManager();
        }
        return SSEClientManager.instance;
    }
    async initGlobalSubscription() {
        await this.redisService.connect();
        // Subscribe to the global Redis channel for broadcasting events
        await this.redisService.subscribe(exports.SSE_REDIS_CHANNEL, (message, channel) => {
            try {
                const eventData = JSON.parse(message);
                this.broadcastToClients(eventData);
            }
            catch (error) {
                console.error("Error processing SSE Redis message:", error);
            }
        });
    }
    async subscribeToUserChannel(userId) {
        const userChannel = `sse:user:${userId}`;
        // Check if we're already subscribed to this user's channel
        if (this.userSubscriptions.has(userChannel)) {
            return;
        }
        await this.redisService.subscribe(userChannel, (message, channel) => {
            try {
                const eventData = JSON.parse(message);
                this.sendToClient(userId, eventData.type, eventData.data);
            }
            catch (error) {
                console.error(`Error processing user channel message: ${userChannel}`, error);
            }
        });
        this.userSubscriptions.add(userChannel);
    }
    async unsubscribeFromUserChannel(userId) {
        const userChannel = `sse:user:${userId}`;
        if (this.userSubscriptions.has(userChannel)) {
            try {
                await this.redisService.unsubscribe(userChannel);
                this.userSubscriptions.delete(userChannel);
            }
            catch (error) {
                console.error(`Error unsubscribing from user channel: ${userChannel}`, error);
            }
        }
    }
    async addClient(userId, res) {
        // If user already has a connection, clean it up first
        if (this.clients.has(userId)) {
            await this.removeClient(userId);
        }
        res.write(`id: ${Date.now()}\n`);
        res.write(`event: connected\n`);
        res.write(`data: ${JSON.stringify({
            message: "SSE connection established",
            userId,
        })}\n\n`);
        this.clients.set(userId, res);
        await this.subscribeToUserChannel(userId);
        // Handle client disconnection
        res.on("close", () => {
            this.removeClient(userId);
        });
    }
    // Remove a client connection
    async removeClient(clientId) {
        // Remove from clients map
        const client = this.clients.get(clientId);
        if (client) {
            try {
                client.end(); // Properly close the connection
            }
            catch (error) {
                console.error(`Error closing client connection for ${clientId}:`, error);
            }
        }
        this.clients.delete(clientId);
        // Unsubscribe from user channel if no other clients for this user
        // (In case you want to support multiple connections per user, you'd need more logic here)
        await this.unsubscribeFromUserChannel(clientId);
    }
    // Send event to a specific client
    sendToClient(clientId, eventType, data) {
        const client = this.clients.get(clientId);
        if (!client)
            return false;
        try {
            client.write(`id: ${Date.now()}\n`);
            client.write(`event: ${eventType}\n`);
            client.write(`data: ${JSON.stringify(data)}\n\n`);
            return true;
        }
        catch (error) {
            console.error(`Error sending SSE event to client ${clientId}:`, error);
            this.removeClient(clientId);
            return false;
        }
    }
    // Broadcast event to all connected clients
    broadcastToClients(event) {
        for (const [clientId, client] of this.clients.entries()) {
            try {
                client.write(`id: ${Date.now()}\n`);
                client.write(`event: ${event.type}\n`);
                client.write(`data: ${JSON.stringify(event.data)}\n\n`);
            }
            catch (error) {
                console.error(`Error broadcasting to client ${clientId}:`, error);
                this.removeClient(clientId);
            }
        }
    }
    // Get number of connected clients
    getClientCount() {
        return this.clients.size;
    }
    // Cleanup all subscriptions (useful for graceful shutdown)
    async cleanup() {
        for (const userChannel of this.userSubscriptions) {
            try {
                await this.redisService.unsubscribe(userChannel);
            }
            catch (error) {
                console.error(`Error unsubscribing from ${userChannel}:`, error);
            }
        }
        this.userSubscriptions.clear();
        this.clients.clear();
    }
}
exports.SSEClientManager = SSEClientManager;
// Function to publish SSE events through Redis
async function publishToSSE(eventType, data) {
    try {
        const redisService = redis_1.default.getInstance();
        await redisService.publish(exports.SSE_REDIS_CHANNEL, JSON.stringify({
            type: eventType,
            data: data,
            timestamp: Date.now(),
        }));
    }
    catch (error) {
        console.error("Error publishing SSE event:", error);
        throw error;
    }
}
async function publishToUser(userId, eventType, data) {
    try {
        const redisService = redis_1.default.getInstance();
        const userChannel = `sse:user:${userId}`;
        await redisService.publish(userChannel, JSON.stringify({
            type: eventType,
            data: data,
            timestamp: Date.now(),
        }));
    }
    catch (error) {
        console.error(`Error publishing SSE event to user ${userId}:`, error);
        throw error;
    }
}
