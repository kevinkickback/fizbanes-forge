import { test, expect } from '@playwright/test';
import { Logger, LOG_LEVELS } from '../../app/js/infrastructure/Logger.js';

test.describe('Logger - Basic Functionality', () => {
  
  test.beforeEach(() => {
    Logger.clearHistory();
    Logger.setLevel('DEBUG');
    Logger.setEnabled(true);
  });

  test('should log debug messages when level is DEBUG', () => {
    Logger.debug('TestCategory', 'Debug message', { test: true });
    
    const history = Logger.getHistory();
    
    expect(history).toHaveLength(1);
    expect(history[0].level).toBe('DEBUG');
    expect(history[0].category).toBe('TestCategory');
    expect(history[0].message).toBe('Debug message');
    expect(history[0].data).toEqual({ test: true });
    expect(history[0].timestamp).toBeTruthy();
  });

  test('should not log debug messages when level is INFO', () => {
    Logger.setLevel('INFO');
    Logger.debug('TestCategory', 'Debug message');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(0);
  });

  test('should log info messages when level is INFO', () => {
    Logger.setLevel('INFO');
    Logger.info('TestCategory', 'Info message');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].level).toBe('INFO');
  });

  test('should log warn messages at all levels except ERROR only', () => {
    Logger.setLevel('WARN');
    Logger.warn('TestCategory', 'Warning message');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].level).toBe('WARN');
  });

  test('should log error messages at all levels', () => {
    Logger.setLevel('ERROR');
    Logger.error('TestCategory', 'Error message', new Error('Test error'));
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].level).toBe('ERROR');
  });
});

test.describe('Logger - Level Management', () => {
  
  test.beforeEach(() => {
    Logger.clearHistory();
    Logger.setLevel('DEBUG');
  });

  test('should set and get log level', () => {
    Logger.setLevel('WARN');
    expect(Logger.getLevel()).toBe('WARN');
  });

  test('should handle invalid log level gracefully', () => {
    Logger.setLevel('INVALID');
    expect(Logger.getLevel()).toBe('INFO'); // Falls back to INFO
  });

  test('should respect log level hierarchy', () => {
    Logger.setLevel('WARN');
    
    Logger.debug('Test', 'Debug');
    Logger.info('Test', 'Info');
    Logger.warn('Test', 'Warn');
    Logger.error('Test', 'Error');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(2); // Only WARN and ERROR
    expect(history[0].level).toBe('WARN');
    expect(history[1].level).toBe('ERROR');
  });
});

test.describe('Logger - History Management', () => {
  
  test.beforeEach(() => {
    Logger.clearHistory();
    Logger.setLevel('DEBUG');
  });

  test('should filter history by log level', () => {
    Logger.debug('Test', 'Debug');
    Logger.info('Test', 'Info');
    Logger.warn('Test', 'Warn');
    Logger.error('Test', 'Error');
    
    const errorLogs = Logger.getHistory('ERROR');
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].level).toBe('ERROR');
    
    const warnLogs = Logger.getHistory('WARN');
    expect(warnLogs).toHaveLength(1);
    expect(warnLogs[0].level).toBe('WARN');
  });

  test('should return all logs when no filter specified', () => {
    Logger.debug('Test', 'Debug');
    Logger.info('Test', 'Info');
    
    const allLogs = Logger.getHistory();
    expect(allLogs).toHaveLength(2);
  });

  test('should clear history', () => {
    Logger.info('Test', 'Message 1');
    Logger.info('Test', 'Message 2');
    
    expect(Logger.getHistory()).toHaveLength(2);
    
    Logger.clearHistory();
    expect(Logger.getHistory()).toHaveLength(0);
  });

  test('should respect max history size', () => {
    const originalMax = Logger.maxHistorySize;
    Logger.maxHistorySize = 3;
    
    Logger.info('Test', 'Message 1');
    Logger.info('Test', 'Message 2');
    Logger.info('Test', 'Message 3');
    Logger.info('Test', 'Message 4');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].message).toBe('Message 2'); // First message dropped
    expect(history[2].message).toBe('Message 4');
    
    Logger.maxHistorySize = originalMax;
  });
});

test.describe('Logger - Enable/Disable', () => {
  
  test.beforeEach(() => {
    Logger.clearHistory();
    Logger.setLevel('DEBUG');
  });

  test('should disable all logging when setEnabled(false)', () => {
    Logger.setEnabled(false);
    
    Logger.debug('Test', 'Debug');
    Logger.info('Test', 'Info');
    Logger.warn('Test', 'Warn');
    Logger.error('Test', 'Error');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(0);
  });

  test('should re-enable logging when setEnabled(true)', () => {
    Logger.setEnabled(false);
    Logger.info('Test', 'Should not log');
    
    Logger.setEnabled(true);
    Logger.info('Test', 'Should log');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].message).toBe('Should log');
  });
});
