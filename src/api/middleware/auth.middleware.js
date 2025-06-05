"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sseAuthHandler = exports.authHandler = exports.verifyToken = void 0;
const http_errors_1 = __importDefault(require("http-errors"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../common/config/config");
const user_schema_1 = __importDefault(require("../../common/schemas/user.schema"));
const verifyToken = (token, secret) => {
    return new Promise((resolve, reject) => {
        jsonwebtoken_1.default.verify(token, secret, (err, decoded) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(decoded);
            }
        });
    });
};
exports.verifyToken = verifyToken;
const authHandler = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return next((0, http_errors_1.default)(401, "Invalid token format. Expected format: Bearer <token>"));
        }
        const token = authHeader.split(" ")[1];
        if (!token) {
            return next((0, http_errors_1.default)(401, "Authentication token not found"));
        }
        // Decode access token
        const decoded = await (0, exports.verifyToken)(token, config_1.config.access.secret);
        const requestingUserId = decoded.userId;
        const requestingUser = await user_schema_1.default.findById(requestingUserId).populate("role");
        if (!requestingUser) {
            return next((0, http_errors_1.default)(401, "Requesting user not found"));
        }
        // Check if the access token is blacklisted
        if (requestingUser.token && requestingUser.token.isBlacklisted) {
            return next((0, http_errors_1.default)(401, "Access token is blacklisted"));
        }
        // Check refresh token for consistency
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            try {
                const refreshDecoded = await (0, exports.verifyToken)(refreshToken, config_1.config.refresh.secret);
                const refreshUserId = refreshDecoded.userId;
                if (requestingUserId !== refreshUserId ||
                    !requestingUser.token ||
                    requestingUser.token.refreshToken !== refreshToken ||
                    requestingUser.token.isBlacklisted) {
                    return next((0, http_errors_1.default)(401, "Invalid token"));
                }
                // Check if the refresh token is expired
                if (requestingUser.token &&
                    new Date() > requestingUser.token.expiresAt) {
                    return next((0, http_errors_1.default)(401, "Invalid token"));
                }
            }
            catch (refreshErr) {
                return next((0, http_errors_1.default)(401, "Invalid token"));
            }
        }
        const _req = req;
        _req.requestingUser = requestingUser;
        next();
    }
    catch (err) {
        console.log(err);
        if (err.name === "TokenExpiredError") {
            return next((0, http_errors_1.default)(401, "Authentication token has expired"));
        }
        else {
            return next((0, http_errors_1.default)(401, "Invalid authentication token"));
        }
    }
};
exports.authHandler = authHandler;
const sseAuthHandler = async (req, res, next) => {
    try {
        const token = req.query.token;
        if (!token)
            return next((0, http_errors_1.default)(401, "Missing token"));
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.access.secret);
        const requestingUser = await user_schema_1.default.findById(decoded.userId).populate("role");
        if (!requestingUser || requestingUser.token?.isBlacklisted) {
            return next((0, http_errors_1.default)(401, "Unauthorized user"));
        }
        const _req = req;
        _req.requestingUser = requestingUser;
        next();
    }
    catch (err) {
        return next((0, http_errors_1.default)(401, "Invalid or expired token"));
    }
};
exports.sseAuthHandler = sseAuthHandler;
