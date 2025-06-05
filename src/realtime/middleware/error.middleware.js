"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketErrorMiddleware = void 0;
const socketErrorMiddleware = (socket, next) => {
    // Custom error handling for socket connections
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
    next();
};
exports.socketErrorMiddleware = socketErrorMiddleware;
