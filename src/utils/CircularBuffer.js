/**
 * Fixed-size circular buffer for efficient rolling window storage
 * Used for tracking response times and detecting anomalies
 */

export default class CircularBuffer {
  /**
   * Create a new circular buffer
   * @param {number} size - Maximum number of elements to store
   */
  constructor(size) {
    if (size <= 0) {
      throw new Error('Buffer size must be positive');
    }
    this.size = size;
    this.buffer = new Array(size);
    this.index = 0;
    this.count = 0;
  }

  /**
   * Add a value to the buffer
   * When full, oldest value is overwritten
   * @param {number} value - Value to add
   */
  push(value) {
    this.buffer[this.index] = value;
    this.index = (this.index + 1) % this.size;
    if (this.count < this.size) {
      this.count += 1;
    }
  }

  /**
   * Get all values in chronological order (oldest to newest)
   * @returns {Array<number>} - Array of values
   */
  getAll() {
    if (this.count < this.size) {
      return this.buffer.slice(0, this.count);
    }
    return [
      ...this.buffer.slice(this.index),
      ...this.buffer.slice(0, this.index),
    ];
  }

  /**
   * Get median value (useful for anomaly detection)
   * @returns {number} - Median value, or 0 if empty
   */
  getMedian() {
    const values = this.getAll().sort((a, b) => a - b);
    if (values.length === 0) return 0;

    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid];
  }

  /**
   * Get average (mean) value
   * @returns {number} - Average value, or 0 if empty
   */
  getAverage() {
    const values = this.getAll();
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Get minimum value
   * @returns {number} - Minimum value, or 0 if empty
   */
  getMin() {
    const values = this.getAll();
    if (values.length === 0) return 0;
    return Math.min(...values);
  }

  /**
   * Get maximum value
   * @returns {number} - Maximum value, or 0 if empty
   */
  getMax() {
    const values = this.getAll();
    if (values.length === 0) return 0;
    return Math.max(...values);
  }

  /**
   * Check if buffer is full
   * @returns {boolean} - True if buffer contains 'size' elements
   */
  isFull() {
    return this.count === this.size;
  }

  /**
   * Get current number of elements in buffer
   * @returns {number} - Number of elements
   */
  length() {
    return this.count;
  }

  /**
   * Clear all values from the buffer
   */
  clear() {
    this.buffer = new Array(this.size);
    this.index = 0;
    this.count = 0;
  }

  /**
   * Convert buffer to JSON-serializable object
   * @returns {Object} - Object with buffer state
   */
  toJSON() {
    return {
      size: this.size,
      values: this.getAll(),
    };
  }

  /**
   * Restore buffer from JSON object
   * @param {Object} json - Object from toJSON()
   * @returns {CircularBuffer} - New CircularBuffer instance
   */
  static fromJSON(json) {
    const buffer = new CircularBuffer(json.size);
    for (const value of json.values) {
      buffer.push(value);
    }
    return buffer;
  }
}
