"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAncestorRoles = getAncestorRoles;
const default_role_hierarchy_1 = require("./default-role-hierarchy");
function getAncestorRoles(roleName) {
    return Object.keys(default_role_hierarchy_1.roleHierarchy).filter(parentRole => default_role_hierarchy_1.roleHierarchy[parentRole].includes(roleName));
}
