"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const http_errors_1 = __importDefault(require("http-errors"));
const transactions_service_1 = __importDefault(require("../transactions/transactions.service"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../../../common/config/config");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const user_schema_1 = __importDefault(require("../../../common/schemas/user.schema"));
const user_type_1 = require("../../../common/types/user.type");
const transaction_type_1 = require("../../../common/types/transaction.type");
class AuthService {
    constructor() {
        this.transactionService = new transactions_service_1.default();
    }
    generateAccessToken(userId) {
        return jsonwebtoken_1.default.sign({ userId }, config_1.config.access.secret, { expiresIn: config_1.config.access.expiresIn });
    }
    generateRefreshToken(userId) {
        return jsonwebtoken_1.default.sign({ userId }, config_1.config.refresh.secret, { expiresIn: config_1.config.refresh.expiresIn });
    }
    async login(username, password, userAgent, ipAddress) {
        const user = await user_schema_1.default.findOne({ username })
            .populate('role')
            .select('+password');
        if (!user) {
            throw (0, http_errors_1.default)(404, 'User not found');
        }
        if (user.status !== user_type_1.UserStatus.ACTIVE) {
            throw (0, http_errors_1.default)(403, 'Account is not active');
        }
        const isValidPassword = await bcrypt_1.default.compare(password, user.password);
        if (!isValidPassword) {
            throw (0, http_errors_1.default)(400, 'Invalid credentials');
        }
        const accessToken = this.generateAccessToken(user._id.toString());
        const refreshToken = this.generateRefreshToken(user._id.toString());
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 Days from now
        user.lastLogin = new Date();
        await user.save();
        user.token = {
            refreshToken,
            userAgent,
            ipAddress,
            expiresAt,
            isBlacklisted: false
        };
        await user.save();
        return {
            accessToken,
            refreshToken,
            user: {
                _id: user._id,
                username: user.username,
                role: user.role,
                balance: user.balance
            }
        };
    }
    async register(data) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const existingUser = await user_schema_1.default.findOne({ username: data.username }).session(session);
            if (existingUser) {
                throw (0, http_errors_1.default)(409, 'Please choose a different username');
            }
            // hash the password
            const hashedPassword = await bcrypt_1.default.hash(data.password, 10);
            // create a new user
            const newUser = new user_schema_1.default({
                name: data.name,
                username: data.username,
                password: hashedPassword,
                balance: 0,
                role: data.roleId,
                status: data.status,
                createdBy: data.createdBy
            });
            await newUser.save({ session });
            // Create a transaction if balance is greater than 0
            if (data.balance > 0 && data.createdBy) {
                await this.transactionService.create(data.createdBy, newUser._id, transaction_type_1.TransactionType.RECHARGE, data.balance, session);
            }
            // Fetch the updated user data
            const updatedUser = await user_schema_1.default.findById(newUser._id)
                .populate('role')
                .session(session);
            await session.commitTransaction();
            return updatedUser;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    async refreshAccessToken(refreshToken) {
        // Validate Refresh Token
        const decoded = await (0, auth_middleware_1.verifyToken)(refreshToken, config_1.config.refresh.secret);
        const userId = decoded.userId;
        const user = await user_schema_1.default.findOne({ _id: userId, "token.refreshToken": refreshToken });
        if (!user) {
            throw (0, http_errors_1.default)(401, 'Invalid refresh token');
        }
        const isTokenExpired = user.token.expiresAt < new Date();
        if (user.token.isBlacklisted || isTokenExpired) {
            throw (0, http_errors_1.default)(401, 'Refresh token expired or blacklisted');
        }
        return this.generateAccessToken(user._id.toString());
    }
    async logout(userId) {
        const user = await user_schema_1.default.findById(userId);
        if (!user) {
            throw (0, http_errors_1.default)(404, 'User not found');
        }
        if (user.token) {
            user.token.isBlacklisted = true; // Set isBlacklisted to true
        }
        await user.save();
    }
}
exports.default = AuthService;
