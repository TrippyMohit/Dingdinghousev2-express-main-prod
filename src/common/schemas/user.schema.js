"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const user_type_1 = require("../types/user.type");
const resources_1 = require("../lib/resources");
const role_schema_1 = __importDefault(require("./role.schema"));
const config_1 = require("../config/config");
const bcrypt_1 = __importDefault(require("bcrypt"));
const TokenSchema = new mongoose_1.Schema({
    refreshToken: { type: String, default: null },
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    isBlacklisted: { type: Boolean, default: false },
}, { _id: false });
const ResourcePermissionSchema = new mongoose_1.Schema({
    resource: {
        type: String,
        enum: Object.values(resources_1.Resource),
        required: true,
    },
    permission: {
        type: String,
        validate: {
            validator: (v) => resources_1.PERMISSION_PATTERN.test(v),
            message: 'Permission must be in format "rwx" where each can be the letter or "-"',
        },
        default: "---",
    },
}, { _id: false });
const UserSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    role: {
        type: mongoose_1.Types.ObjectId,
        ref: "Role",
        require: true,
    },
    status: {
        type: String,
        enum: Object.values(user_type_1.UserStatus),
        default: user_type_1.UserStatus.ACTIVE,
    },
    createdBy: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
        default: null,
        nullable: true,
    },
    totalSpent: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    lastLogin: { type: Date, default: null },
    favouriteGames: {
        type: [mongoose_1.Types.ObjectId],
        ref: "Game",
        default: [],
    },
    token: {
        type: TokenSchema,
        default: null,
    },
    path: {
        type: String,
        required: true,
    },
    permissions: {
        type: [ResourcePermissionSchema],
        default: [],
    },
}, { timestamps: true });
// Middleware to set the materialized path before saving
UserSchema.pre("validate", async function (next) {
    if (this.isNew) {
        const role = await role_schema_1.default.findById(this.role);
        if (!role) {
            throw new Error("Role is required");
        }
        if (role?.name === config_1.config.root.role) {
            const existingAdmin = await User.findOne({
                role: role._id,
                _id: { $ne: this._id }, // Exclude current document
            });
            if (existingAdmin) {
                throw new Error("Admin already exists");
            }
            this.createdBy = undefined;
            this.path = this._id.toString();
            this.balance = Infinity;
            this.permissions = (0, resources_1.generateDefaultPermissions)(role.name);
        }
        else if (this.createdBy) {
            const parentUser = await User.findById(this.createdBy);
            if (parentUser) {
                this.path = `${parentUser.path}/${this._id}`;
            }
            else {
                this.path = this._id.toString();
            }
            this.permissions = (0, resources_1.generateDefaultPermissions)(role?.name);
        }
        else {
            this.path = this._id.toString();
            this.permissions = (0, resources_1.generateDefaultPermissions)(role?.name);
        }
    }
    next();
});
// Middleware to check for child users before deleting
UserSchema.pre("deleteOne", { document: true, query: false }, async function (next) {
    const user = this;
    const childUsers = await User.find({ createdBy: user._id });
    if (childUsers.length > 0) {
        return next(new Error("Cannot delete user with existing child users. Please delete the child users first."));
    }
    next();
});
// Method to get all descendant users using materialized path
UserSchema.methods.getDescendants = async function () {
    const descendants = await User.find({
        path: { $regex: `^${this.path}/` },
        status: { $ne: user_type_1.UserStatus.DELETED },
    });
    return descendants;
};
UserSchema.methods.can = function (resource, action) {
    const permission = this.permissions.find((p) => p.resource === resource);
    if (!permission)
        return false;
    const pos = { r: 0, w: 1, x: 2 }[action];
    return permission.permission[pos] === action;
};
UserSchema.methods.getPermissionString = function (resource) {
    const permission = this.permissions.find((p) => p.resource === resource);
    return permission ? permission.permission : "---";
};
UserSchema.statics.ensureRootUser = async function () {
    const rootRole = await role_schema_1.default.findOne({ name: config_1.config.root.role });
    if (!rootRole) {
        throw new Error("Root role must exist before creating root user");
    }
    const rootExists = await this.findOne({ username: config_1.config.root.username });
    if (!rootExists) {
        if (!config_1.config.root.password) {
            throw new Error("Root password must be defined in the configuration");
        }
        const hashedPassword = await bcrypt_1.default.hash(config_1.config.root.password, 10);
        return await this.create({
            name: config_1.config.root.name,
            username: config_1.config.root.username,
            password: hashedPassword,
            role: rootRole._id,
            status: user_type_1.UserStatus.ACTIVE,
            credits: Infinity,
            path: "",
            permissions: (0, resources_1.generateDefaultPermissions)(rootRole.name),
        });
    }
    return rootExists;
};
UserSchema.statics.getAdminIdsFromPath = async function (userPath) {
    // For root user - get all direct admin descendants
    if (!userPath.includes("/")) {
        const adminUsers = await this.find({
            path: new RegExp(`^${userPath}/[^/]+$`), // Match direct descendants only
            status: { $ne: user_type_1.UserStatus.DELETED }, // Include any status except DELETED
        });
        return adminUsers.map((admin) => admin._id);
    }
    // For other users - get their admin's ID from path
    const pathParts = userPath.split("/");
    if (pathParts.length > 1) {
        const adminId = new mongoose_1.Types.ObjectId(pathParts[1]);
        // Check if the admin user is not deleted
        const adminUser = await this.findOne({
            _id: adminId,
            status: { $ne: user_type_1.UserStatus.DELETED },
        });
        // Only return the admin ID if the admin is not deleted
        return adminUser ? [adminId] : [];
    }
    return [];
};
const User = (0, mongoose_1.model)("User", UserSchema);
exports.default = User;
