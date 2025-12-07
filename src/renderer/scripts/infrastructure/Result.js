/** Lightweight Result helper for explicit success/error handling. */

class Result {
	constructor(isSuccess, value, error) {
		this._isSuccess = isSuccess;
		this._value = value;
		this._error = error;
	}

	/**
	 * Create a successful Result.
	 * @param {*} value - The success value
	 * @returns {Result} Result containing the value
	 */
	static ok(value) {
		return new Result(true, value, null);
	}

	/**
	 * Create a failed Result.
	 * @param {*} error - The error value
	 * @returns {Result} Result containing the error
	 */
	static err(error) {
		return new Result(false, null, error);
	}

	/**
	 * Check if Result is successful.
	 * @returns {boolean} True if successful
	 */
	isOk() {
		return this._isSuccess;
	}

	/**
	 * Check if Result is an error.
	 * @returns {boolean} True if error
	 */
	isErr() {
		return !this._isSuccess;
	}

	/**
	 * Get the success value.
	 * @returns {*} The value if successful
	 * @throws {Error} If Result is an error
	 */
	get value() {
		if (this._isSuccess) {
			return this._value;
		}
		throw new Error('Cannot get value from error Result');
	}

	/**
	 * Get the error value.
	 * @returns {*} The error if failed
	 * @throws {Error} If Result is successful
	 */
	get error() {
		if (!this._isSuccess) {
			return this._error;
		}
		throw new Error('Cannot get error from successful Result');
	}

	/**
	 * Map a function over the success value.
	 * @param {Function} fn - Function to apply to value
	 * @returns {Result} New Result with mapped value or original error
	 */
	map(fn) {
		if (this._isSuccess) {
			try {
				return Result.ok(fn(this._value));
			} catch (error) {
				return Result.err(error.message);
			}
		}
		return this;
	}

	/**
	 * Map a function over the error value.
	 * @param {Function} fn - Function to apply to error
	 * @returns {Result} New Result with mapped error or original value
	 */
	mapErr(fn) {
		if (!this._isSuccess) {
			return Result.err(fn(this._error));
		}
		return this;
	}

	/**
	 * Chain Result-returning operations.
	 * @param {Function} fn - Function that returns a Result
	 * @returns {Result} Result from fn or original error
	 */
	andThen(fn) {
		if (this._isSuccess) {
			return fn(this._value);
		}
		return this;
	}

	/**
	 * Get value or return default.
	 * @param {*} defaultValue - Value to return if error
	 * @returns {*} Value if successful, defaultValue if error
	 */
	unwrapOr(defaultValue) {
		return this._isSuccess ? this._value : defaultValue;
	}

	/**
	 * Get value or compute default from error.
	 * @param {Function} fn - Function to compute default from error
	 * @returns {*} Value if successful, fn(error) if error
	 */
	unwrapOrElse(fn) {
		return this._isSuccess ? this._value : fn(this._error);
	}

	/**
	 * Match on Result and execute corresponding function.
	 * @param {Object} pattern - Object with ok and err functions
	 * @returns {*} Result of matched function
	 */
	match(pattern) {
		if (this._isSuccess) {
			return pattern.ok(this._value);
		}
		return pattern.err(this._error);
	}
}

export { Result };

