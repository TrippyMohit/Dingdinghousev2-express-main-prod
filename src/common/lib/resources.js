"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDefaultPermissions = exports.PERMISSION_PATTERN = exports.DEFAULT_USER_PERMISSION = exports.DEFAULT_ADMIN_PERMISSION = exports.Resource = void 0;
const config_1 = require("../config/config");
var Resource;
(function (Resource) {
    Resource["USERS"] = "users";
    Resource["TRANSACTIONS"] = "transactions";
    Resource["REPORTS"] = "reports";
    Resource["GAMES"] = "games";
    Resource["ROLES"] = "roles";
})(Resource || (exports.Resource = Resource = {}));
exports.DEFAULT_ADMIN_PERMISSION = 'rwx';
exports.DEFAULT_USER_PERMISSION = 'r--';
exports.PERMISSION_PATTERN = /^[r-][w-][x-]$/;
const generateDefaultPermissions = (role) => {
    return Object.values(Resource).map(resource => ({
        resource,
        permission: role === config_1.config.root.role ? exports.DEFAULT_ADMIN_PERMISSION : exports.DEFAULT_USER_PERMISSION
    }));
};
exports.generateDefaultPermissions = generateDefaultPermissions;
