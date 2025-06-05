"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorResponse = exports.successResponse = void 0;
const successResponse = (data, message = 'Successful', meta) => {
    const response = {
        success: true,
        message,
        data,
    };
    if (meta) {
        response.meta = meta;
    }
    return response;
};
exports.successResponse = successResponse;
const errorResponse = (status, message, errorStack = "") => {
    return {
        success: false,
        error: {
            status,
            message,
            stack: errorStack || undefined, // Include stack only if provided
        },
    };
};
exports.errorResponse = errorResponse;
