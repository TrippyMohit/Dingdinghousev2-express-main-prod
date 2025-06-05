"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sse_controller_1 = __importDefault(require("./sse.controller"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const cors_1 = __importDefault(require("cors"));
const config_1 = require("../../../common/config/config");
const router = (0, express_1.Router)();
const controller = new sse_controller_1.default();
// Apply specific CORS settings for SSE endpoints
const sseSpecificCors = (0, cors_1.default)({
    origin: config_1.config.clientUrl,
    credentials: true,
    methods: ["GET"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Type", "Connection", "Cache-Control"],
});
router.get("/connect", sseSpecificCors, auth_middleware_1.sseAuthHandler, controller.sseHanler);
router.get("/stats", auth_middleware_1.sseAuthHandler, controller.sseStatsHandler);
exports.default = router;
