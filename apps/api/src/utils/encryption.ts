/**
 * Encryption Utility for API Keys
 * Uses AES-256-GCM for secure encryption/decryption
 * Validates: Requirements 14.2
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag
const SALT_LENGTH = 32; // 32 bytes for key derivation

interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}

class EncryptionService {
  private masterKey: string;

  constructor() {
    this.masterKey = process.env.ENCRYPTION_KEY || '';
    
    if (!this.masterKey) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }

    // Validate key length (should be 32 bytes when base64 decoded or 32 characters)
    if (this.masterKey.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
    }
  }

  /**
   * Derive a 256-bit key from the master key using PBKDF2
   */
  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      this.masterKey,
      salt,
      100000, // iterations
      32, // key length (256 bits)
      'sha256'
    );
  }

  /**
   * Encrypt a string using AES-256-GCM
   * @param plaintext - The text to encrypt
   * @returns Encrypted data with IV, auth tag, and salt
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random salt for key derivation
      const salt = crypto.randomBytes(SALT_LENGTH);
      
      // Derive encryption key from master key
      const key = this.deriveKey(salt);
      
      // Generate random IV
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine all components into a single string
      const encryptedData: EncryptedData = {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        salt: salt.toString('hex'),
      };
      
      // Return as base64-encoded JSON
      return Buffer.from(JSON.stringify(encryptedData)).toString('base64');
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a string using AES-256-GCM
   * @param encryptedString - The encrypted string (base64-encoded JSON)
   * @returns Decrypted plaintext
   */
  decrypt(encryptedString: string): string {
    try {
      // Decode base64 and parse JSON
      const encryptedData: EncryptedData = JSON.parse(
        Buffer.from(encryptedString, 'base64').toString('utf8')
      );
      
      // Convert hex strings back to buffers
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      
      // Derive the same key using the stored salt
      const key = this.deriveKey(salt);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt API key for storage
   * @param apiKey - The API key to encrypt
   * @returns Encrypted API key
   */
  encryptApiKey(apiKey: string): string {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API key cannot be empty');
    }
    return this.encrypt(apiKey);
  }

  /**
   * Decrypt API key from storage
   * @param encryptedApiKey - The encrypted API key
   * @returns Decrypted API key
   */
  decryptApiKey(encryptedApiKey: string): string {
    if (!encryptedApiKey || encryptedApiKey.trim().length === 0) {
      throw new Error('Encrypted API key cannot be empty');
    }
    return this.decrypt(encryptedApiKey);
  }

  /**
   * Rotate encryption by re-encrypting with a new salt
   * Useful for periodic key rotation
   * @param encryptedString - The currently encrypted string
   * @returns Newly encrypted string with different salt
   */
  rotateEncryption(encryptedString: string): string {
    const decrypted = this.decrypt(encryptedString);
    return this.encrypt(decrypted);
  }

  /**
   * Validate that a string can be decrypted
   * @param encryptedString - The encrypted string to validate
   * @returns true if valid, false otherwise
   */
  isValidEncrypted(encryptedString: string): boolean {
    try {
      this.decrypt(encryptedString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a secure random API key
   * @param length - Length of the API key (default: 32)
   * @returns Random API key
   */
  generateApiKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash a value using SHA-256 (one-way, for comparison)
   * @param value - The value to hash
   * @returns Hashed value
   */
  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}

// Export singleton instance (lazy initialization)
let encryptionServiceInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
}

// Export class for testing
export { EncryptionService };

// Default export for convenience (lazy)
export default {
  get instance() {
    return getEncryptionService();
  }
};
