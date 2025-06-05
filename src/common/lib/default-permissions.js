"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultPermission = void 0;
const default_role_hierarchy_1 = require("./default-role-hierarchy");
const resources_1 = require("./resources");
exports.defaultPermission = {
    [default_role_hierarchy_1.Roles.ROOT]: {
        [resources_1.Resource.USERS]: "rwx",
        [resources_1.Resource.TRANSACTIONS]: "rwx",
        [resources_1.Resource.REPORTS]: "rwx",
        [resources_1.Resource.GAMES]: "rwx",
        [resources_1.Resource.ROLES]: "rwx"
    },
    [default_role_hierarchy_1.Roles.ADMIN]: {
        [resources_1.Resource.USERS]: "rwx",
        [resources_1.Resource.TRANSACTIONS]: "rwx",
        [resources_1.Resource.REPORTS]: "rwx",
        [resources_1.Resource.GAMES]: "rwx",
        [resources_1.Resource.ROLES]: "r--",
    },
    [default_role_hierarchy_1.Roles.STORE]: {
        [resources_1.Resource.USERS]: "rwx",
        [resources_1.Resource.TRANSACTIONS]: "rwx",
        [resources_1.Resource.REPORTS]: "r--",
        [resources_1.Resource.GAMES]: "r--",
        [resources_1.Resource.ROLES]: "r--",
    },
    [default_role_hierarchy_1.Roles.PLAYER]: {
        [resources_1.Resource.USERS]: "r--",
        [resources_1.Resource.TRANSACTIONS]: "r--",
        [resources_1.Resource.REPORTS]: "---",
        [resources_1.Resource.GAMES]: "r--",
        [resources_1.Resource.ROLES]: "r--",
    },
};
