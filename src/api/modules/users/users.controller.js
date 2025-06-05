"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importDefault(require("mongoose"));
const resources_1 = require("../../../common/lib/resources");
const response_1 = require("../../../common/lib/response");
class UserController {
    constructor(userService) {
        this.userService = userService;
        this.deleteUser = this.deleteUser.bind(this);
        this.getCurrentUser = this.getCurrentUser.bind(this);
        this.getDescendants = this.getDescendants.bind(this);
        this.getDescendantsOfUser = this.getDescendantsOfUser.bind(this);
        this.updateUser = this.updateUser.bind(this);
        this.getUserById = this.getUserById.bind(this);
        this.getUserReport = this.getUserReport.bind(this);
        this.getUserPermissions = this.getUserPermissions.bind(this);
        this.updateUserPermissions = this.updateUserPermissions.bind(this);
        this.getDescendantsReport = this.getDescendantsReport.bind(this);
    }
    async getCurrentUser(req, res, next) {
        try {
            const { requestingUser } = req;
            if (!requestingUser) {
                throw (0, http_errors_1.default)(400, "Requesting user not found");
            }
            //   const filteredPermissions =
            //     requestingUser.role?.name === Roles.PLAYER
            //       ? []
            //       : requestingUser.permissions
            //           .map((p) =>
            //             p.resource === Resource.ROLES && p.permission !== "rwx"
            //               ? null
            //               : p
            //           )
            //           .filter(Boolean);
            const filteredPermissions = requestingUser.permissions
                .map((p) => p.resource === resources_1.Resource.ROLES && p.permission !== "rwx" ? null : p)
                .filter(Boolean);
            const data = {
                _id: requestingUser._id,
                name: requestingUser.name,
                username: requestingUser.username,
                role: requestingUser.role,
                balance: requestingUser.balance,
                status: requestingUser.status,
                permissions: filteredPermissions,
            };
            res
                .status(200)
                .json((0, response_1.successResponse)(data, "User details retrieved successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    async getUserById(req, res, next) {
        try {
            const { requestingUser } = req;
            if (!requestingUser) {
                throw (0, http_errors_1.default)(400, "Requesting user not found");
            }
            const { userId } = req.params;
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw (0, http_errors_1.default)(400, "Invalid user ID");
            }
            const user = await this.userService.getUserById(requestingUser._id, new mongoose_1.default.Types.ObjectId(userId));
            if (!user) {
                throw (0, http_errors_1.default)(404, "User not found");
            }
            res
                .status(200)
                .json((0, response_1.successResponse)(user, "User retrieved successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    async getDescendantsOfUser(req, res, next) {
        try {
            const { requestingUser } = req;
            if (!requestingUser) {
                throw (0, http_errors_1.default)(400, "Requesting user not found");
            }
            const { userId } = req.params;
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw (0, http_errors_1.default)(400, "Invalid user ID");
            }
            // Fetch the target user
            const targetUser = await this.userService.getUserById(requestingUser._id, new mongoose_1.default.Types.ObjectId(userId));
            if (!targetUser) {
                throw (0, http_errors_1.default)(404, "Target user not found");
            }
            const { page = "1", limit = "10", from, to, sortBy = "createdAt", sortOrder = "desc", search = "", view, role, status, username, } = req.query;
            // Build filters object
            const queryFilters = {};
            // Add search filter
            if (search) {
                queryFilters.search = search;
            }
            // Add date range filter
            if (from || to) {
                queryFilters.createdAt = {};
                if (from)
                    queryFilters.createdAt.$gte = new Date(from);
                if (to)
                    queryFilters.createdAt.$lte = new Date(to);
            }
            // Add role filter
            if (role) {
                queryFilters.role = role;
            }
            // Add status filter
            if (status) {
                queryFilters.status = status;
            }
            // Add username filter
            if (username) {
                queryFilters.username = username;
            }
            // Add view filter
            if (view) {
                queryFilters.view = view;
            }
            const options = {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
            };
            const result = await this.userService.getDescendants(new mongoose_1.default.Types.ObjectId(userId), queryFilters, options);
            res
                .status(200)
                .json((0, response_1.successResponse)(result.data, "Descendants retrieved successfully", result.meta));
        }
        catch (error) {
            next(error);
        }
    }
    async updateUser(req, res, next) {
        try {
            const { requestingUser } = req;
            if (!requestingUser) {
                throw (0, http_errors_1.default)(400, "Requesting user not found");
            }
            const { userId } = req.params;
            const { balance, ...updateData } = req.body;
            const updatedUser = await this.userService.updateUser(requestingUser._id.toString(), new mongoose_1.default.Types.ObjectId(userId), { ...updateData, balance: balance?.amount }, balance?.type);
            res
                .status(200)
                .json((0, response_1.successResponse)(updatedUser, "User updated successfully"));
        }
        catch (error) {
            console.error(error);
            next(error);
        }
    }
    async deleteUser(req, res, next) {
        try {
            const { requestingUser } = req;
            if (!requestingUser) {
                throw (0, http_errors_1.default)(400, "Requesting user not found");
            }
            const { userId } = req.params;
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw (0, http_errors_1.default)(400, "Invalid user ID");
            }
            const deletedUser = await this.userService.deleteUser(userId);
            res
                .status(200)
                .json((0, response_1.successResponse)(deletedUser, `User deleted successfully`));
        }
        catch (error) {
            console.error(error);
            next(error);
        }
    }
    async getDescendants(req, res, next) {
        try {
            const { requestingUser } = req;
            if (!requestingUser) {
                throw (0, http_errors_1.default)(400, "Requesting user not found");
            }
            const { page = "1", limit = "10", from, to, sortBy = "createdAt", sortOrder = "desc", search = "", view, role, status, username, } = req.query;
            // Build filters object
            const queryFilters = {};
            // Add search filter
            if (search) {
                queryFilters.search = search;
            }
            // Add date range filter
            if (from || to) {
                queryFilters.createdAt = {};
                if (from)
                    queryFilters.createdAt.$gte = new Date(from);
                if (to)
                    queryFilters.createdAt.$lte = new Date(to);
            }
            // Add role filter
            if (role) {
                queryFilters.role = role;
            }
            // Add status filter
            if (status) {
                queryFilters.status = status;
            }
            // Add username filter
            if (username) {
                console.log("username", username);
                queryFilters.username = username;
            }
            // Add view filter
            if (view) {
                queryFilters.view = view;
            }
            const options = {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
            };
            const result = await this.userService.getDescendants(requestingUser._id, queryFilters, options);
            res
                .status(200)
                .json((0, response_1.successResponse)(result.data, "Descendants retrieved successfully", result.meta));
        }
        catch (error) {
            next(error);
        }
    }
    async getDescendantsReport(req, res, next) {
        try {
            const { requestingUser } = req;
            if (!requestingUser) {
                throw (0, http_errors_1.default)(400, "Requesting user not found");
            }
            const { from, to } = req.query;
            if (!mongoose_1.default.Types.ObjectId.isValid(requestingUser._id)) {
                throw (0, http_errors_1.default)(400, "Invalid user ID");
            }
            const report = await this.userService.generateDescendantsReport(new mongoose_1.default.Types.ObjectId(requestingUser._id), from ? new Date(from) : undefined, to ? new Date(to) : undefined);
            res.status(200).json({
                success: true,
                message: "Descendants report generated successfully",
                data: report,
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getUserReport(req, res, next) {
        try {
            const { requestingUser } = req;
            if (!requestingUser) {
                throw (0, http_errors_1.default)(400, "Requesting user not found");
            }
            const { userId } = req.params;
            const { from, to } = req.query;
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw (0, http_errors_1.default)(400, "Invalid user ID");
            }
            // Parse the query parameters if they are provided
            const fromDate = from ? new Date(from) : undefined;
            const toDate = to ? new Date(to) : undefined;
            const report = await this.userService.generateUserReport(new mongoose_1.default.Types.ObjectId(userId), fromDate, toDate);
            res
                .status(200)
                .json((0, response_1.successResponse)(report, "User report generated successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    async updateUserPermissions(req, res, next) {
        try {
            const { userId } = req.params;
            const { permissions, operation } = req.body;
            if (!mongoose_1.default.isValidObjectId(userId)) {
                throw (0, http_errors_1.default)(400, "Invalid user ID format");
            }
            if (!permissions || !Array.isArray(permissions) || !operation) {
                throw (0, http_errors_1.default)(400, "Invalid request format");
            }
            const updatedUser = await this.userService.updateUserPermissions(new mongoose_1.default.Types.ObjectId(userId), permissions, operation);
            res
                .status(200)
                .json((0, response_1.successResponse)(updatedUser, "User permissions updated successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    async getUserPermissions(req, res, next) {
        try {
            const { userId } = req.params;
            const { requestingUser } = req;
            if (!mongoose_1.default.isValidObjectId(userId)) {
                throw (0, http_errors_1.default)(400, "Invalid user ID format");
            }
            const user = await this.userService.getUserById(requestingUser._id, new mongoose_1.default.Types.ObjectId(userId));
            res
                .status(200)
                .json((0, response_1.successResponse)(user?.permissions || [], "User permissions retrieved successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    async getUserFavouriteGames(req, res, next) {
        try {
            const { userId } = req.params;
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw (0, http_errors_1.default)(400, "Invalid user ID");
            }
            const favouriteGames = await this.userService.getUserFavouriteGames(new mongoose_1.default.Types.ObjectId(userId));
            res
                .status(200)
                .json((0, response_1.successResponse)(favouriteGames, "Favourite games retrieved successfully"));
        }
        catch (error) {
            next(error);
        }
    }
    async updateFavouriteGames(req, res, next) {
        try {
            const { requestingUser } = req;
            if (!requestingUser) {
                throw (0, http_errors_1.default)(400, "Requesting user not found");
            }
            const { userId } = req.params;
            const { game, action } = req.body; // `action` can be 'add' or 'remove'
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw (0, http_errors_1.default)(400, "Invalid user ID");
            }
            if (!game || typeof game !== "string") {
                throw (0, http_errors_1.default)(400, "Game must be a valid string");
            }
            if (!["add", "remove"].includes(action)) {
                throw (0, http_errors_1.default)(400, 'Action must be either "add" or "remove"');
            }
            const updatedUser = await this.userService.updateFavouriteGames(new mongoose_1.default.Types.ObjectId(userId), new mongoose_1.default.Types.ObjectId(game), action);
            res
                .status(200)
                .json((0, response_1.successResponse)(updatedUser, "Favourite games updated successfully"));
        }
        catch (error) {
            next(error);
        }
    }
}
exports.default = UserController;
