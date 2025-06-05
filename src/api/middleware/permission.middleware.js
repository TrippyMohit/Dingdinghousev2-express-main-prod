"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPermission = void 0;
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importDefault(require("mongoose"));
const resources_1 = require("../../common/lib/resources");
const role_schema_1 = __importDefault(require("../../common/schemas/role.schema"));
const user_schema_1 = __importDefault(require("../../common/schemas/user.schema"));
const checkPermission = (resource, action) => {
    return async (req, res, next) => {
        try {
            const { requestingUser } = req;
            if (!requestingUser) {
                throw (0, http_errors_1.default)(400, 'Requesting user ID not found');
            }
            // Check basic permission
            if (!requestingUser.can(resource, action)) {
                throw (0, http_errors_1.default)(403, 'Permission denied');
            }
            // If dealing with user-related operations
            if ((resource === resources_1.Resource.USERS || resource === resources_1.Resource.TRANSACTIONS) && req.params.userId) {
                if (!mongoose_1.default.isValidObjectId(req.params.userId)) {
                    throw (0, http_errors_1.default)(400, 'Invalid user ID format');
                }
                // Allow if user is accessing their own data
                if (req.params.userId === requestingUser._id.toString()) {
                    return next();
                }
                const targetUser = await user_schema_1.default.findById(req.params.userId).populate('role');
                if (!targetUser) {
                    throw (0, http_errors_1.default)(404, 'User not found');
                }
                if (!requestingUser.role.descendants.includes(targetUser.role._id)) {
                    throw (0, http_errors_1.default)(403, 'You cannot access users with this role level');
                }
                // Check if the requesting user is an ancestor of the target user
                if (!targetUser.path.includes(requestingUser._id.toString())) {
                    throw (0, http_errors_1.default)(403, 'You are not authorized to perform this action');
                }
            }
            // If dealing with role-related operations
            if (resource === resources_1.Resource.ROLES && req.params.roleId) {
                if (!mongoose_1.default.isValidObjectId(req.params.roleId)) {
                    throw (0, http_errors_1.default)(400, 'Invalid role ID format');
                }
                // Allow if user is accessing their own role
                if (req.params.roleId === requestingUser.role._id.toString()) {
                    return next();
                }
                const targetRole = await role_schema_1.default.findById(req.params.roleId).lean();
                if (!targetRole) {
                    throw (0, http_errors_1.default)(404, 'Role not found');
                }
                // Check if requesting user's role has the target role in its descendants
                if (!requestingUser.role.descendants.includes(targetRole._id)) {
                    throw (0, http_errors_1.default)(403, 'You cannot access roles with this level');
                }
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.checkPermission = checkPermission;
