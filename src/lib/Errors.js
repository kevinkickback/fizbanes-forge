/**
 * Base application error class
 */
export class AppError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.details = details;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace?.(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack,
        };
    }
}

/**
 * Error for invalid input parameters
 */
export class ValidationError extends AppError {
    constructor(message, details = {}) {
        super(message, details);
    }
}

/**
 * Error for data not found
 */
export class NotFoundError extends AppError {
    constructor(resource, identifier, details = {}) {
        super(`${resource} not found: ${identifier}`, {
            resource,
            identifier,
            ...details,
        });
    }
}

/**
 * Error for service initialization failures
 */
export class ServiceError extends AppError {
    constructor(serviceName, message, details = {}) {
        super(`${serviceName}: ${message}`, {
            serviceName,
            ...details,
        });
    }
}

/**
 * Error for data loading/parsing failures
 */
export class DataError extends AppError {
    constructor(message, details = {}) {
        super(message, details);
    }
}

/**
 * Error for invalid character state transitions
 */
export class CharacterStateError extends AppError {
    constructor(message, details = {}) {
        super(message, details);
    }
}

/**
 * Error for serialization/deserialization failures
 */
export class SerializationError extends AppError {
    constructor(message, details = {}) {
        super(message, details);
    }
}
