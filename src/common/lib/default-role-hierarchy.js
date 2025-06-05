"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleHierarchy = exports.Roles = void 0;
var Roles;
(function (Roles) {
    Roles["ROOT"] = "root";
    Roles["ADMIN"] = "admin";
    Roles["STORE"] = "store";
    Roles["PLAYER"] = "player";
})(Roles || (exports.Roles = Roles = {}));
exports.roleHierarchy = {
    [Roles.ROOT]: [Roles.ADMIN, Roles.STORE, Roles.PLAYER],
    [Roles.ADMIN]: [Roles.STORE, Roles.PLAYER],
    [Roles.STORE]: [Roles.PLAYER],
    [Roles.PLAYER]: [],
};
