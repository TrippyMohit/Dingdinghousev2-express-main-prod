"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../common/config/config");
const response_1 = require("../../common/lib/response");
const errorHandler = (err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    const errorStack = config_1.config.env === "development" ? err.stack : "";
    return res.status(status).json((0, response_1.errorResponse)(status, message, errorStack));
};
exports.default = errorHandler;
