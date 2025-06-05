"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = __importDefault(require("./auth.controller"));
const auth_service_1 = __importDefault(require("./auth.service"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const permission_middleware_1 = require("../../middleware/permission.middleware");
const resources_1 = require("../../../common/lib/resources");
const authRoutes = (0, express_1.Router)();
const authService = new auth_service_1.default();
const authController = new auth_controller_1.default(authService);
authRoutes.post("/login", authController.login);
authRoutes.post("/logout", auth_middleware_1.authHandler, authController.logout);
authRoutes.post("/register", auth_middleware_1.authHandler, (0, permission_middleware_1.checkPermission)(resources_1.Resource.USERS, "w"), authController.register);
authRoutes.post("/refresh-token", authController.refreshAccessToken);
exports.default = authRoutes;
