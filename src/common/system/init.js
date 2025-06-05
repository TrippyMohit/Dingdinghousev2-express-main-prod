"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
const role_schema_1 = __importDefault(require("../schemas/role.schema"));
const user_schema_1 = __importDefault(require("../schemas/user.schema"));
async function init() {
    try {
        await role_schema_1.default.ensureRoleHierarchy();
        await user_schema_1.default.ensureRootUser();
    }
    catch (error) {
        console.error('Failed to initialize system:', error);
        throw error;
    }
}
