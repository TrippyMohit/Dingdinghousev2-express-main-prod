"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleStatus = exports.DescendantOperation = void 0;
var DescendantOperation;
(function (DescendantOperation) {
    DescendantOperation["ADD"] = "add";
    DescendantOperation["REMOVE"] = "remove";
    DescendantOperation["REPLACE"] = "replace";
})(DescendantOperation || (exports.DescendantOperation = DescendantOperation = {}));
var RoleStatus;
(function (RoleStatus) {
    RoleStatus["ACTIVE"] = "active";
    RoleStatus["INACTIVE"] = "inactive";
    RoleStatus["DELETED"] = "deleted";
})(RoleStatus || (exports.RoleStatus = RoleStatus = {}));
