"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = logMethod;
/**
 * A method decorator that logs method calls, execution time, and errors.
 * @example
 * ```typescript
 * class ExampleService {
 *   @LogMethod()
 *   async fetchData(id: string) {
 *     // Method implementation
 *   }
 * }
 * ```
 *
 * @returns {MethodDecorator} A method decorator function
 */
function logMethod(original, context) {
    const methodName = String(context.name);
    function replacement(...args) {
        console.log(`[${methodName}] Called with:`, args);
        const result = original.call(this, ...args);
        console.log(`[${methodName}] Returned:`, result);
        return result;
    }
    return replacement;
}
// Usage:
// class ExampleService {
//   @LogMethod()
//   async fetchData(id: string) {
//     // Your method implementation
//   }
// }
