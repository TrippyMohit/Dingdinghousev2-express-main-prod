"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = api;
const express_1 = __importStar(require("express"));
const os_1 = __importDefault(require("os"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_route_1 = __importDefault(require("./modules/auth/auth.route"));
const roles_routes_1 = __importDefault(require("./modules/roles/roles.routes"));
const users_route_1 = __importDefault(require("./modules/users/users.route"));
const transactions_route_1 = __importDefault(require("./modules/transactions/transactions.route"));
const games_route_1 = __importDefault(require("./modules/games/games.route"));
const error_middleware_1 = __importDefault(require("./middleware/error.middleware"));
const config_1 = require("../common/config/config");
const sse_route_1 = __importDefault(require("./modules/sse/sse.route"));
function api(app) {
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((0, cookie_parser_1.default)());
    app.use((0, cors_1.default)({
        origin: [config_1.config.clientUrl],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["set-cookie"],
    }));
    // Create main router for all API routes
    const router = (0, express_1.Router)();
    // Root endpoint
    app.get("/", (req, res) => {
        const response = {
            uptime: os_1.default.uptime(),
            timestamp: new Date().toISOString(),
            message: "Server is running...",
        };
        res.json(response);
    });
    // Register module specific routes
    router.use("/auth", auth_route_1.default);
    router.use("/roles", roles_routes_1.default);
    router.use("/users", users_route_1.default);
    router.use("/transactions", transactions_route_1.default);
    router.use("/games", games_route_1.default);
    router.use("/sse", sse_route_1.default);
    // Mount the API router to /api path
    app.use("/api", router);
    // Error handling middleware
    app.use(error_middleware_1.default);
    console.log("API routes initialized");
}
