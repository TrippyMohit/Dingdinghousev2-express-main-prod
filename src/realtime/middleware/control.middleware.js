"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.controlAuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../common/config/config");
const controlAuthMiddleware = (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: Token required'));
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.access.secret);
        socket.data.user = decoded;
        next();
    }
    catch (error) {
        next(new Error('Authentication error: Invalid token'));
    }
};
exports.controlAuthMiddleware = controlAuthMiddleware;
