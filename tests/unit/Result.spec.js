import { test, expect } from '@playwright/test';
import { Result } from '../../app/js/infrastructure/Result.js';

test.describe('Result - Success Cases', () => {

    test('should create successful Result with ok()', () => {
        const result = Result.ok({ data: 'test' });

        expect(result.isOk()).toBe(true);
        expect(result.isErr()).toBe(false);
        expect(result.value).toEqual({ data: 'test' });
    });

    test('should create successful Result with primitive value', () => {
        const result = Result.ok(42);

        expect(result.isOk()).toBe(true);
        expect(result.value).toBe(42);
    });

    test('should create successful Result with null value', () => {
        const result = Result.ok(null);

        expect(result.isOk()).toBe(true);
        expect(result.value).toBe(null);
    });

    test('should map over successful Result', () => {
        const result = Result.ok(5);
        const mapped = result.map(x => x * 2);

        expect(mapped.isOk()).toBe(true);
        expect(mapped.value).toBe(10);
    });

    test('should chain map operations', () => {
        const result = Result.ok(3)
            .map(x => x * 2)
            .map(x => x + 1)
            .map(x => x.toString());

        expect(result.isOk()).toBe(true);
        expect(result.value).toBe('7');
    });

    test('should unwrapOr return value for successful Result', () => {
        const result = Result.ok('success');
        expect(result.unwrapOr('default')).toBe('success');
    });

    test('should unwrapOrElse return value for successful Result', () => {
        const result = Result.ok('success');
        expect(result.unwrapOrElse(() => 'default')).toBe('success');
    });

    test('should andThen chain Result-returning operations', () => {
        const result = Result.ok(5)
            .andThen(x => Result.ok(x * 2))
            .andThen(x => Result.ok(x + 1));

        expect(result.isOk()).toBe(true);
        expect(result.value).toBe(11);
    });

    test('should match execute ok branch', () => {
        const result = Result.ok(42);
        const matched = result.match({
            ok: (val) => `Success: ${val}`,
            err: (err) => `Error: ${err}`
        });

        expect(matched).toBe('Success: 42');
    });
});

test.describe('Result - Error Cases', () => {

    test('should create error Result with err()', () => {
        const result = Result.err('Something went wrong');

        expect(result.isErr()).toBe(true);
        expect(result.isOk()).toBe(false);
        expect(result.error).toBe('Something went wrong');
    });

    test('should create error Result with error object', () => {
        const errorObj = new Error('Test error');
        const result = Result.err(errorObj);

        expect(result.isErr()).toBe(true);
        expect(result.error).toBe(errorObj);
    });

    test('should not map over error Result', () => {
        const result = Result.err('error');
        const mapped = result.map(x => x * 2);

        expect(mapped.isErr()).toBe(true);
        expect(mapped.error).toBe('error');
    });

    test('should unwrapOr return default for error Result', () => {
        const result = Result.err('error');
        expect(result.unwrapOr('default')).toBe('default');
    });

    test('should unwrapOrElse compute default for error Result', () => {
        const result = Result.err('error');
        expect(result.unwrapOrElse(err => `Failed: ${err}`)).toBe('Failed: error');
    });

    test('should handle errors with mapErr()', () => {
        const result = Result.err('Original error');
        const mapped = result.mapErr(e => `Wrapped: ${e}`);

        expect(mapped.isErr()).toBe(true);
        expect(mapped.error).toBe('Wrapped: Original error');
    });

    test('should not andThen on error Result', () => {
        const result = Result.err('error')
            .andThen(x => Result.ok(x * 2));

        expect(result.isErr()).toBe(true);
        expect(result.error).toBe('error');
    });

    test('should match execute err branch', () => {
        const result = Result.err('failure');
        const matched = result.match({
            ok: (val) => `Success: ${val}`,
            err: (err) => `Error: ${err}`
        });

        expect(matched).toBe('Error: failure');
    });

    test('should throw when accessing value on error Result', () => {
        const result = Result.err('error');
        expect(() => result.value).toThrow('Cannot get value from error Result');
    });

    test('should throw when accessing error on success Result', () => {
        const result = Result.ok('success');
        expect(() => result.error).toThrow('Cannot get error from successful Result');
    });
});

test.describe('Result - Edge Cases', () => {

    test('should handle map function that throws', () => {
        const result = Result.ok(5);
        const mapped = result.map(x => {
            throw new Error('Map failed');
        });

        expect(mapped.isErr()).toBe(true);
        expect(mapped.error).toBe('Map failed');
    });

    test('should handle andThen that returns error', () => {
        const result = Result.ok(5)
            .andThen(x => Result.err('Processing failed'));

        expect(result.isErr()).toBe(true);
        expect(result.error).toBe('Processing failed');
    });

    test('should preserve error through map chain', () => {
        const result = Result.err('initial error')
            .map(x => x * 2)
            .map(x => x + 1);

        expect(result.isErr()).toBe(true);
        expect(result.error).toBe('initial error');
    });
});
