"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupPlayground = setupPlayground;
const playground_service_1 = __importDefault(require("./playground.service"));
const playground_events_1 = require("./playground.events");
const sse_events_1 = require("../../../common/lib/sse.events");
function setupPlayground(namespace) {
    const playgroundService = playground_service_1.default.getInstance();
    namespace.on("connection", async (socket) => {
        try {
            const { userId } = socket.data.user;
            const { id: gameId } = socket.data.game;
            const { engine, state } = await playgroundService.initialize(gameId, userId);
            // Get and send initialization data
            const initData = await engine.getInitData(userId);
            socket.emit(playground_events_1.Events.SERVER.INIT_DATA.name, JSON.stringify(initData));
            await (0, sse_events_1.publishToUser)(userId, sse_events_1.SSEEventTypes.GAME_STARTED, {
                userId,
                gameId,
                socketId: socket.id,
                timestamp: new Date().toISOString(),
            });
            // Handle config update request
            socket.on(playground_events_1.Events.CLIENT.CONFIG_UPDATE.name, async (payload) => {
                try {
                    const updatedEngine = await playgroundService.reinitialize(gameId, payload.content);
                    // Send the updated config back to the client
                    socket.emit(playground_events_1.Events.SERVER.CONFIG.name, updatedEngine.getConfig());
                }
                catch (error) {
                    socket.emit(playground_events_1.Events.SERVER.ERROR.name, {
                        message: error instanceof Error
                            ? error.message
                            : "Failed to update game configuration",
                        code: "CONFIG_UPDATE_ERROR",
                    });
                }
            });
            // Handle spin requests
            socket.on(playground_events_1.Events.CLIENT.SPIN_REQUEST.name, async (payload) => {
                try {
                    const data = JSON.parse(payload);
                    const result = await engine.handleAction({
                        type: "spin",
                        userId,
                        payload: {
                            betAmount: parseFloat(data.currentBet),
                        },
                    });
                    socket.emit(playground_events_1.Events.SERVER.SPIN_RESULT.name, JSON.stringify(result));
                }
                catch (error) {
                    socket.emit(playground_events_1.Events.SERVER.ERROR.name, JSON.stringify({
                        message: error instanceof Error
                            ? error.message
                            : "An unknown error occurred",
                        code: "SPIN_ERROR",
                    }));
                }
            });
            //NOTE: gameble request handler
            socket.on(playground_events_1.Events.CLIENT.GAMBLE_REQUEST.name, async (payload) => {
                try {
                    const data = JSON.parse(payload);
                    const result = await engine.handleAction({
                        type: "gamble",
                        userId,
                        payload: {
                            type: data.type,
                            lastWinning: data.lastWinning ? parseFloat(data.lastWinning) : 0,
                            cardSelected: data.cardSelected || null,
                            Event: data.Event || null
                        }
                    });
                    socket.emit(playground_events_1.Events.SERVER.GAMBLE_RESULT.name, JSON.stringify(result));
                }
                catch (e) {
                    console.error("Gamble request error:", e);
                }
            });
            socket.on("disconnect", async () => {
                console.log(`Player disconnected from game ${gameId} : ${userId}`);
                await (0, sse_events_1.publishToUser)(userId, sse_events_1.SSEEventTypes.GAME_ENDED, {
                    userId,
                    gameId,
                    socketId: socket.id,
                    timestamp: new Date().toISOString(),
                });
            });
        }
        catch (error) {
            console.error("Connection error:", error);
            socket.emit(playground_events_1.Events.SERVER.ERROR.name, {
                message: "Failed to initialize game session",
                code: "INIT_ERROR",
            });
            socket.disconnect(true);
        }
    });
}
