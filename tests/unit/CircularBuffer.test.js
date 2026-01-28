/**
 * Unit tests for CircularBuffer
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import CircularBuffer from '../../src/utils/CircularBuffer.js';

describe('CircularBuffer', () => {
  describe('constructor', () => {
    it('should create a buffer with specified size', () => {
      const buffer = new CircularBuffer(5);
      assert.strictEqual(buffer.size, 5);
      assert.strictEqual(buffer.length(), 0);
    });

    it('should throw error for invalid size', () => {
      assert.throws(() => new CircularBuffer(0), /Buffer size must be positive/);
      assert.throws(() => new CircularBuffer(-5), /Buffer size must be positive/);
    });
  });

  describe('push', () => {
    it('should add values to buffer', () => {
      const buffer = new CircularBuffer(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      assert.strictEqual(buffer.length(), 3);
      assert.deepStrictEqual(buffer.getAll(), [1, 2, 3]);
    });

    it('should overwrite oldest value when full', () => {
      const buffer = new CircularBuffer(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4); // Should overwrite 1

      assert.strictEqual(buffer.length(), 3);
      assert.deepStrictEqual(buffer.getAll(), [2, 3, 4]);
    });
  });

  describe('getMedian', () => {
    it('should return median of odd number of values', () => {
      const buffer = new CircularBuffer(5);
      buffer.push(1);
      buffer.push(3);
      buffer.push(5);

      assert.strictEqual(buffer.getMedian(), 3);
    });

    it('should return median of even number of values', () => {
      const buffer = new CircularBuffer(5);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);

      assert.strictEqual(buffer.getMedian(), 2.5);
    });

    it('should return 0 for empty buffer', () => {
      const buffer = new CircularBuffer(5);
      assert.strictEqual(buffer.getMedian(), 0);
    });
  });

  describe('getAverage', () => {
    it('should return average of values', () => {
      const buffer = new CircularBuffer(5);
      buffer.push(10);
      buffer.push(20);
      buffer.push(30);

      assert.strictEqual(buffer.getAverage(), 20);
    });

    it('should return 0 for empty buffer', () => {
      const buffer = new CircularBuffer(5);
      assert.strictEqual(buffer.getAverage(), 0);
    });
  });

  describe('getMin and getMax', () => {
    it('should return min and max values', () => {
      const buffer = new CircularBuffer(5);
      buffer.push(5);
      buffer.push(1);
      buffer.push(10);
      buffer.push(3);

      assert.strictEqual(buffer.getMin(), 1);
      assert.strictEqual(buffer.getMax(), 10);
    });
  });

  describe('clear', () => {
    it('should clear all values', () => {
      const buffer = new CircularBuffer(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      buffer.clear();

      assert.strictEqual(buffer.length(), 0);
      assert.deepStrictEqual(buffer.getAll(), []);
    });
  });

  describe('isFull', () => {
    it('should return false when not full', () => {
      const buffer = new CircularBuffer(3);
      buffer.push(1);
      assert.strictEqual(buffer.isFull(), false);
    });

    it('should return true when full', () => {
      const buffer = new CircularBuffer(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      assert.strictEqual(buffer.isFull(), true);
    });
  });

  describe('toJSON and fromJSON', () => {
    it('should serialize and deserialize buffer', () => {
      const buffer = new CircularBuffer(5);
      buffer.push(10);
      buffer.push(20);
      buffer.push(30);

      const json = buffer.toJSON();
      const restored = CircularBuffer.fromJSON(json);

      assert.strictEqual(restored.size, buffer.size);
      assert.deepStrictEqual(restored.getAll(), buffer.getAll());
    });
  });
});
