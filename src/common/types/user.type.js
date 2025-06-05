"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionOperation = exports.UserStatus = void 0;
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["INACTIVE"] = "inactive";
    UserStatus["DELETED"] = "deleted";
    UserStatus["SUSPENDED"] = "suspended";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var PermissionOperation;
(function (PermissionOperation) {
    PermissionOperation["ADD"] = "add";
    PermissionOperation["REMOVE"] = "remove";
    PermissionOperation["REPLACE"] = "replace";
})(PermissionOperation || (exports.PermissionOperation = PermissionOperation = {}));
