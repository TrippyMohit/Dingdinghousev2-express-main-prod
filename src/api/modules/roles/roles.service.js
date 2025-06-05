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
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importStar(require("mongoose"));
const config_1 = require("../../../common/config/config");
const default_role_hierarchy_1 = require("../../../common/lib/default-role-hierarchy");
const role_schema_1 = __importDefault(require("../../../common/schemas/role.schema"));
const role_type_1 = require("../../../common/types/role.type");
const user_schema_1 = __importDefault(require("../../../common/schemas/user.schema"));
const user_type_1 = require("../../../common/types/user.type");
class RoleService {
    async addRole(name, descendants) {
        const existingRole = await role_schema_1.default.findOne({
            name: { $regex: new RegExp(`^${name}$`, "i") },
            status: role_type_1.RoleStatus.ACTIVE,
        });
        if (existingRole) {
            throw (0, http_errors_1.default)(400, "Role already exists");
        }
        const role = new role_schema_1.default({ name, descendants });
        await role.save();
        return role;
    }
    async getRole(id) {
        const role = await role_schema_1.default.findOne({
            _id: id,
            status: { $ne: role_type_1.RoleStatus.DELETED },
        }).populate({
            path: "descendants",
            select: "name status",
            match: { status: role_type_1.RoleStatus.ACTIVE },
        });
        if (!role) {
            throw (0, http_errors_1.default)(404, "Role not found");
        }
        return role;
    }
    async getAllRoles(filters = {}, options = {}) {
        const { page = 1, limit = 10, search, sortBy = "createdAt", sortOrder = "desc", requestingRoleId, } = options;
        const query = {
            status: { $ne: role_type_1.RoleStatus.DELETED },
            ...filters,
        };
        // Add search filter
        if (search) {
            query["name"] = new RegExp(search, "i");
        }
        // Add role hierarchy filter
        if (requestingRoleId) {
            const requestingRole = await role_schema_1.default.findById(requestingRoleId);
            if (requestingRole) {
                query["_id"] = { $in: [...requestingRole.descendants] };
            }
        }
        const [roles, total] = await Promise.all([
            role_schema_1.default.find(query)
                .select("_id name status") // Only select required fields
                .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
                .skip((page - 1) * limit)
                .limit(limit),
            role_schema_1.default.countDocuments(query),
        ]);
        return {
            data: roles,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }
    async validateRole(requestingRoleId, targetRoleId) {
        const requestingRole = await role_schema_1.default.findOne({
            _id: requestingRoleId,
            status: role_type_1.RoleStatus.ACTIVE,
        });
        if (!requestingRole) {
            throw (0, http_errors_1.default)(404, "Requesting role not found");
        }
        if (!requestingRole.descendants.includes(targetRoleId)) {
            throw (0, http_errors_1.default)(403, "Access denied: Role hierarchy violation");
        }
    }
    async updateRole(id, params) {
        const role = await role_schema_1.default.findById(id);
        if (!role) {
            throw http_errors_1.default.NotFound("Role not found");
        }
        // Update name if provided
        if (params.name) {
            role.name = params.name;
        }
        // Update status if provided
        if (params.status) {
            role.status = params.status;
        }
        // Update descendants if provided
        if (params.descendants && params.operation) {
            const descendantObjectIds = params.descendants.map((id) => new mongoose_1.Types.ObjectId(id));
            const count = await role_schema_1.default.countDocuments({
                _id: { $in: descendantObjectIds },
                status: { $ne: role_type_1.RoleStatus.DELETED },
            });
            if (count !== params.descendants.length) {
                throw http_errors_1.default.BadRequest("One or more descendant roles not found or inactive");
            }
            switch (params.operation) {
                case role_type_1.DescendantOperation.ADD:
                    // Convert existing descendants to strings for comparison
                    const existingDescendants = new Set(role.descendants.map((d) => d.toString()));
                    // Add new descendants, ensuring uniqueness
                    descendantObjectIds.forEach((id) => {
                        if (!existingDescendants.has(id.toString())) {
                            role.descendants.push(id);
                        }
                    });
                    break;
                case role_type_1.DescendantOperation.REMOVE:
                    // Convert descendants to remove to strings for comparison
                    const descendantsToRemove = new Set(descendantObjectIds.map((id) => id.toString()));
                    // Filter out the descendants to remove
                    role.descendants = role.descendants.filter((d) => !descendantsToRemove.has(d.toString()));
                    break;
                case role_type_1.DescendantOperation.REPLACE:
                    role.descendants = descendantObjectIds;
                    break;
            }
        }
        await role.save();
        return role;
    }
    async deleteRole(id) {
        const role = await role_schema_1.default.findOne({
            _id: id,
            status: { $ne: role_type_1.RoleStatus.DELETED },
        });
        if (!role) {
            throw (0, http_errors_1.default)(404, "Active role not found");
        }
        // Check if the role is a root role or a system role
        if (role.name === config_1.config.root.role ||
            role.name === default_role_hierarchy_1.Roles.ADMIN ||
            role.name === default_role_hierarchy_1.Roles.PLAYER) {
            throw http_errors_1.default.Forbidden("Cannot delete this role");
        }
        // Check for users with this role
        // Check for active users with this role
        const activeUsersWithRole = await user_schema_1.default.countDocuments({
            role: role._id,
            status: user_type_1.UserStatus.ACTIVE,
        });
        if (activeUsersWithRole > 0) {
            throw http_errors_1.default.Conflict("Cannot delete role with existing active users");
        }
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                await role_schema_1.default.findByIdAndUpdate(id, {
                    status: role_type_1.RoleStatus.DELETED,
                    name: `${role.name}_DELETED_${Date.now()}`, // Ensure unique name
                });
                await role_schema_1.default.findOneAndUpdate({ name: config_1.config.root.role }, { $pull: { descendants: role._id } });
                // Remove from all other roles' descendants
                await role_schema_1.default.updateMany({ descendants: role._id }, { $pull: { descendants: role._id } });
            });
        }
        finally {
            await session.endSession();
        }
    }
}
exports.default = RoleService;
