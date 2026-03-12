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

export class ValidationError extends AppError {
    constructor(message, details = {}) {
        super(message, details);
    }
}

export class NotFoundError extends AppError {
    constructor(resource, identifier, details = {}) {
        super(`${resource} not found: ${identifier}`, {
            resource,
            identifier,
            ...details,
        });
    }
}

export class ServiceError extends AppError {
    constructor(serviceName, message, details = {}) {
        super(`${serviceName}: ${message}`, {
            serviceName,
            ...details,
        });
    }
}

export class DataError extends AppError {
    constructor(message, details = {}) {
        super(message, details);
    }
}

export class CharacterStateError extends AppError {
    constructor(message, details = {}) {
        super(message, details);
    }
}

export class SerializationError extends AppError {
    constructor(message, details = {}) {
        super(message, details);
    }
}
