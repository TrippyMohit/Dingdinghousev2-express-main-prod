"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_errors_1 = __importDefault(require("http-errors"));
const roles_service_1 = __importDefault(require("../roles/roles.service"));
const zod_1 = require("zod");
const mongoose_1 = require("mongoose");
const response_1 = require("../../../common/lib/response");
const config_1 = require("../../../common/config/config");
const user_type_1 = require("../../../common/types/user.type");
class AuthController {
    constructor(authService) {
        this.authService = authService;
        this.registerSchema = zod_1.z.object({
            name: zod_1.z
                .string({ required_error: "Name is required" })
                .min(2, "Name must be at least 2 characters long")
                .max(100, "Name is too long"),
            username: zod_1.z
                .string({ required_error: "Username is required" })
                .min(3, "Username must be at least 3 characters long")
                .max(30, "Username is too long"),
            password: zod_1.z
                .string({ required_error: "Password is required" })
                .min(6, "Password must be at least 6 characters long"),
            roleId: zod_1.z
                .string({ required_error: "Role ID is required" })
                .refine((val) => mongoose_1.Types.ObjectId.isValid(val), {
                message: "Invalid role ID format",
            }),
            balance: zod_1.z.number().default(0),
            status: zod_1.z.nativeEnum(user_type_1.UserStatus, {
                required_error: "Status is required",
                invalid_type_error: "Status must be a valid user status",
            }),
        });
        this.roleService = new roles_service_1.default();
        this.login = this.login.bind(this);
        this.logout = this.logout.bind(this);
        this.register = this.register.bind(this);
        this.refreshAccessToken = this.refreshAccessToken.bind(this);
    }
    async login(req, res, next) {
        try {
            const { username, password } = req.body;
            const userAgent = req.get("User-Agent");
            const ipAddress = req.ip;
            if (!username || !password) {
                throw (0, http_errors_1.default)(400, "Username and password are required");
            }
            const { refreshToken, accessToken, user } = await this.authService.login(username, password, userAgent, ipAddress);
            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: config_1.config.env === "production",
                sameSite: config_1.config.env === "production" ? "none" : "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000,
                path: "/",
                domain: config_1.config.domain,
            });
            // Send the access token in response body (for authorization in API requests)
            res
                .status(200)
                .json((0, response_1.successResponse)({ accessToken, user }, "Login successful"));
        }
        catch (error) {
            next(error);
        }
    }
    async register(req, res, next) {
        try {
            const { requestingUser } = req;
            const validationResult = this.registerSchema.safeParse(req.body);
            if (!validationResult.success) {
                const errorMessage = validationResult.error.errors[0].message;
                throw (0, http_errors_1.default)(400, errorMessage);
            }
            const { name, username, password, roleId, status, balance } = validationResult.data;
            if (!requestingUser) {
                throw (0, http_errors_1.default)(400, "Requesting user ID not found");
            }
            // Validate role exits
            const targetRole = await this.roleService.getRole(new mongoose_1.Types.ObjectId(roleId));
            if (!targetRole) {
                throw (0, http_errors_1.default)(404, "Role not found");
            }
            // Validare the role hierarchy
            await this.roleService.validateRole(requestingUser.role._id, new mongoose_1.Types.ObjectId(roleId));
            const newUser = await this.authService.register({
                name,
                username,
                password,
                roleId: new mongoose_1.Types.ObjectId(roleId),
                status,
                balance, // ✅ Optional value is passed only if present
                createdBy: requestingUser._id,
            });
            res
                .status(200)
                .json((0, response_1.successResponse)(newUser, "User registered successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    async refreshAccessToken(req, res, next) {
        try {
            const refreshToken = req.cookies.refreshToken; // Extract refresh token from the cookie
            if (!refreshToken) {
                return next((0, http_errors_1.default)(401, "Refresh token not provided"));
            }
            const accessToken = await this.authService.refreshAccessToken(refreshToken);
            res
                .status(200)
                .json((0, response_1.successResponse)({ accessToken }, "Access Token refreshed successfully"));
        }
        catch (error) {
            console.error("REFRESH TOKEN : ", error);
            next(error);
        }
    }
    async logout(req, res, next) {
        try {
            const { requestingUser } = req;
            if (!requestingUser) {
                throw (0, http_errors_1.default)(400, "Requesting user ID not found");
            }
            await this.authService.logout(requestingUser._id);
            res.clearCookie("refreshToken"); // Clear the refresh token cookie
            res.status(200).json((0, response_1.successResponse)({}, "Logged out successfully"));
        }
        catch (error) {
            next(error);
        }
    }
}
exports.default = AuthController;
