"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const db_1 = __importDefault(require("./src/common/config/db"));
const init_1 = require("./src/common/system/init");
const api_1 = __importDefault(require("./src/api"));
const config_1 = require("./src/common/config/config");
const realtime_1 = __importDefault(require("./src/realtime"));
const redis_1 = __importDefault(require("./src/common/config/redis"));
async function bootstrap() {
    const app = (0, express_1.default)();
    const httpServer = (0, http_1.createServer)(app);
    try {
        // Connect to database
        await (0, db_1.default)();
        // Initialize Redis 
        const redisService = redis_1.default.getInstance();
        await redisService.connect();
        console.log('Connected to Redis successfully');
        // Run system initialization
        await (0, init_1.init)();
        // Set up API routes
        (0, api_1.default)(app);
        // Set up Socket
        const io = (0, realtime_1.default)(httpServer, redisService);
        // Start server
        const PORT = config_1.config.port;
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`API available at http://localhost:${PORT}/api`);
            console.log(`WebSocket available at ws://localhost:${PORT}`);
        });
        // Graceful shutdown
        const shutdown = async () => {
            console.log('Shutting down gracefully...');
            io.close(); // Close Socket.IO first
            await redisService.disconnect();
            httpServer.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
bootstrap().catch(console.error);
