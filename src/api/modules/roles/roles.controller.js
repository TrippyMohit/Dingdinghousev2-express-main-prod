"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const http_errors_1 = __importDefault(require("http-errors"));
const response_1 = require("../../../common/lib/response");
const role_type_1 = require("../../../common/types/role.type");
class RoleController {
    constructor(roleService) {
        this.roleService = roleService;
        this.addRole = this.addRole.bind(this);
        this.deleteRole = this.deleteRole.bind(this);
        this.getRoleById = this.getRoleById.bind(this);
        this.getAllRoles = this.getAllRoles.bind(this);
        this.updateRole = this.updateRole.bind(this);
    }
    async addRole(req, res, next) {
        try {
            const { name, descendants } = req.body;
            const role = await this.roleService.addRole(name, descendants || []);
            res.status(201).json((0, response_1.successResponse)(role, 'Role created successfully'));
        }
        catch (err) {
            next(err);
        }
    }
    async updateRole(req, res, next) {
        try {
            const { roleId } = req.params;
            const { name, status, descendants, operation } = req.body;
            if (!mongoose_1.default.isValidObjectId(roleId)) {
                throw (0, http_errors_1.default)(400, 'Invalid role ID');
            }
            // Validate status if provided
            if (status && ![role_type_1.RoleStatus.ACTIVE, role_type_1.RoleStatus.INACTIVE].includes(status)) {
                throw (0, http_errors_1.default)(400, 'Status can only be active or inactive');
            }
            // Validate descendants if provided
            if (descendants !== undefined) {
                if (!operation) {
                    throw http_errors_1.default.BadRequest('Operation is required when updating descendants');
                }
                if (!Object.values(role_type_1.DescendantOperation).includes(operation)) {
                    throw (0, http_errors_1.default)(400, 'Invalid operation type');
                }
                if (!Array.isArray(descendants)) {
                    throw (0, http_errors_1.default)(400, 'Descendants must be an array');
                }
            }
            const role = await this.roleService.updateRole(roleId, {
                name,
                status,
                descendants,
                operation: operation
            });
            res.status(200).json((0, response_1.successResponse)(role, `Role ${role.name} updated successfully`));
        }
        catch (error) {
            next(error);
        }
    }
    async deleteRole(req, res, next) {
        try {
            const { roleId } = req.params;
            if (!mongoose_1.default.isValidObjectId(roleId)) {
                throw (0, http_errors_1.default)(400, 'Invalid role ID');
            }
            await this.roleService.deleteRole(roleId);
            res.status(200).json((0, response_1.successResponse)(null, 'Role deleted successfully'));
        }
        catch (err) {
            next(err);
        }
    }
    async getRoleById(req, res, next) {
        try {
            const { roleId } = req.params;
            if (!mongoose_1.default.isValidObjectId(roleId)) {
                throw (0, http_errors_1.default)(400, 'Invalid role ID');
            }
            const role = await this.roleService.getRole(new mongoose_1.default.Types.ObjectId(roleId));
            res.status(200).json((0, response_1.successResponse)(role, 'Role retrieved successfully'));
        }
        catch (err) {
            next(err);
        }
    }
    async getAllRoles(req, res, next) {
        try {
            const { requestingUser } = req;
            const { page = "1", limit = "10", search, sortBy = "createdAt", sortOrder = "desc", ...filters } = req.query;
            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                search: search,
                sortBy,
                sortOrder,
                requestingRoleId: requestingUser.role._id
            };
            const result = await this.roleService.getAllRoles(filters, options);
            res.status(200).json((0, response_1.successResponse)(result.data, 'Roles retrieved successfully', result.meta));
        }
        catch (err) {
            next(err);
        }
    }
}
exports.default = RoleController;
