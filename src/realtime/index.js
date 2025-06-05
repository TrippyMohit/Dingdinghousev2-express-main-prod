"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = realtime;
const socket_io_1 = require("socket.io");
const control_gateway_1 = require("./gateways/control/control.gateway");
const playground_gateway_1 = require("./gateways/playground/playground.gateway");
const control_middleware_1 = require("./middleware/control.middleware");
const playground_middleware_1 = require("./middleware/playground.middleware");
const redis_adapter_1 = require("@socket.io/redis-adapter");
function realtime(httpServer, redisService) {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*",
            methods: ['GET', 'POST'],
            credentials: true
        },
        transports: ['websocket', 'polling'],
        adapter: (0, redis_adapter_1.createAdapter)(redisService.getPublisher(), redisService.getSubscriber())
    });
    // Health check endpoint
    io.of('/').adapter.on('error', (err) => {
        console.error('Socket.IO adapter error:', err);
    });
    // Set up control namespace with authentication
    const controlNamespace = io.of('/control');
    controlNamespace.use(control_middleware_1.controlAuthMiddleware);
    (0, control_gateway_1.setupControl)(controlNamespace);
    // Set up playground namespace
    const playgroundNamespace = io.of('/playground');
    playgroundNamespace.use(playground_middleware_1.playgroundAuthMiddleware);
    (0, playground_gateway_1.setupPlayground)(playgroundNamespace);
    console.log('Socket service initialized');
    return io;
}
