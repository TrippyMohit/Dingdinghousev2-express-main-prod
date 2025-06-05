"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.playgroundAuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../common/config/config");
const playground_service_1 = __importDefault(require("../gateways/playground/playground.service"));
const playgroundAuthMiddleware = async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token)
        return next(new Error("Playground token required"));
    const service = new playground_service_1.default();
    const tokenData = await service.validateToken(token);
    if (!tokenData) {
        return next(new Error("Invalid or expired game token"));
    }
    const platformToken = tokenData.platform;
    try {
        const decoded = jsonwebtoken_1.default.verify(platformToken, config_1.config.access.secret);
        socket.data = {
            user: {
                userId: decoded.userId,
            },
            game: {
                id: tokenData.gameId,
            },
        };
        next();
    }
    catch (error) {
        console.error("JWT verification error:", error);
        next(new Error("Invalid platform token"));
    }
};
exports.playgroundAuthMiddleware = playgroundAuthMiddleware;
