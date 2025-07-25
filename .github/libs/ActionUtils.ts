import * as core from '@actions/core';

/**
 * Safely parse a JSON input to a GitHub Action.
 *
 * @param name - The name of the input.
 * @param options - Options to pass to core.getInput
 * @param [defaultValue] - A default value to provide for the input.
 *                         Not required if the {required: true} option is given in the second arg to this function.
 */
function getJSONInput(name: string, options: core.InputOptions, defaultValue?: unknown): unknown {
    const input = core.getInput(name, options);
    if (input) {
        return JSON.parse(input);
    }
    return defaultValue;
}

/**
 * Safely access a string input to a GitHub Action, or fall back on a default if the string is empty.
 */
function getStringInput(name: string, options: core.InputOptions, defaultValue?: string): string | undefined {
    const input = core.getInput(name, options);
    if (!input) {
        return defaultValue;
    }
    return input;
}

/**
 * Converts a value to a number, returning 0 for non-numeric values.
 */
function convertToNumber(value: unknown): number {
    switch (typeof value) {
        case 'number':
            return value;
        case 'string':
            if (!Number.isNaN(Number(value))) {
                return Number(value);
            }
            return 0;
        default:
            return 0;
    }
}

export {getJSONInput, getStringInput, convertToNumber};
