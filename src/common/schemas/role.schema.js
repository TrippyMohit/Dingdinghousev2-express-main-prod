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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const role_type_1 = require("../types/role.type");
const utils_1 = require("../lib/utils");
const default_role_hierarchy_1 = require("../lib/default-role-hierarchy");
const INITIALIZATION_FLAG = "ROLES_INITIALIZED";
const RoleSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    descendants: {
        type: [mongoose_1.Types.ObjectId],
        ref: "Role",
        default: []
    },
    status: {
        type: String,
        enum: Object.values(role_type_1.RoleStatus),
        default: role_type_1.RoleStatus.ACTIVE
    }
}, { timestamps: true });
RoleSchema.pre("validate", async function (next) {
    if (this.isNew) {
        const ancestorRoleNames = (0, utils_1.getAncestorRoles)(this.name);
        // If no ancestors found, add to root role's descendants
        if (ancestorRoleNames.length === 0) {
            const rootRole = await Role.findOne({ name: default_role_hierarchy_1.Roles.ROOT });
            if (rootRole && !rootRole.descendants.includes(this._id)) {
                rootRole.descendants.push(this._id);
                await rootRole.save();
            }
        }
        else {
            // Add to all ancestor roles' descendants
            for (const ancestorName of ancestorRoleNames) {
                const ancestorRole = await Role.findOne({ name: ancestorName });
                if (ancestorRole && !ancestorRole.descendants.includes(this._id)) {
                    ancestorRole.descendants.push(this._id);
                    await ancestorRole.save();
                }
            }
        }
    }
    next();
});
// Helper method to ensure a specific role exists
RoleSchema.statics.ensureRole = async function (roleName) {
    const existingRole = await this.findOne({ name: roleName });
    if (!existingRole) {
        return await this.create({
            name: roleName,
            descendants: [],
            status: role_type_1.RoleStatus.ACTIVE,
        });
    }
    return existingRole;
};
// Method to ensure all predefined roles exist and maintain correct hierarchy
RoleSchema.statics.ensureRoleHierarchy = async function () {
    try {
        // Ensure database connection
        if (!mongoose_1.default.connection.db) {
            throw new Error("Database connection not established");
        }
        // Check if roles are already initialized with proper typing
        const initFlag = await mongoose_1.default.connection.db
            .collection("system_flags")
            .findOne({ _id: INITIALIZATION_FLAG });
        if (initFlag) {
            console.log("Roles already initialized, skipping...");
            return;
        }
        // Create roles and set up hierarchy
        const rolePromises = Object.values(default_role_hierarchy_1.Roles).map((roleName) => this.ensureRole(roleName));
        await Promise.all(rolePromises);
        const roles = await this.find({ name: { $in: Object.values(default_role_hierarchy_1.Roles) } });
        const roleMap = new Map();
        roles.forEach((role) => roleMap.set(role.name, role));
        // Set up hierarchy for all roles
        for (const [parentName, childNames] of Object.entries(default_role_hierarchy_1.roleHierarchy)) {
            const parentRole = roleMap.get(parentName);
            if (!parentRole)
                continue;
            const childIds = childNames
                .map((name) => roleMap.get(name)?._id)
                .filter((id) => id !== undefined);
            parentRole.descendants = childIds;
            await parentRole.save();
        }
        // Mark initialization as complete with proper typing
        await mongoose_1.default.connection.db
            .collection("system_flags")
            .insertOne({
            _id: INITIALIZATION_FLAG,
            timestamp: new Date(),
        });
        console.log("Role hierarchy initialized successfully");
        return roles;
    }
    catch (error) {
        console.error("Error initializing role hierarchy:", error);
        throw error;
    }
};
const Role = mongoose_1.default.model("Role", RoleSchema);
exports.default = Role;
