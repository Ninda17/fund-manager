const crypto = require('crypto');
const logger = require('./logger');

// Encryption key - should be stored in environment variable in production
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  logger.warn('WARNING: ENCRYPTION_KEY not set in environment variables. Using default key (NOT SECURE FOR PRODUCTION).');
  // Generate a default key (64 hex characters = 32 bytes)
  ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

// Ensure key is exactly 64 hex characters (32 bytes)
if (ENCRYPTION_KEY.length !== 64) {
  logger.warn('WARNING: ENCRYPTION_KEY must be 64 hex characters. Generating a new key.');
  ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
}

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypts a value using AES-256-CBC

 */
const encrypt = (value) => {
  try {
    // Convert value to string if it's not already
    const text = typeof value === 'string' ? value : value.toString();
    
    // Generate a random IV for each encryption
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const key = Buffer.from(ENCRYPTION_KEY, 'hex'); 
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data (both hex encoded, separated by ':')
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error('Encryption error:', { error: error.message, stack: error.stack });
    throw new Error('Failed to encrypt data');
  }
};

/**

 */
const decrypt = (encryptedValue) => {
  try {
    if (!encryptedValue || typeof encryptedValue !== 'string') {
      return encryptedValue; // Return as-is if not encrypted
    }
    
    // Split IV and encrypted data
    const parts = encryptedValue.split(':');
    if (parts.length !== 2) {
      return encryptedValue; // Return as-is if format is incorrect
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    // Create decipher
    const key = Buffer.from(ENCRYPTION_KEY, 'hex'); // ENCRYPTION_KEY is already 64 hex chars (32 bytes)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    // Decrypt the text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption error:', { error: error.message, stack: error.stack });
    // Return original value if decryption fails (for backward compatibility)
    return encryptedValue;
  }
};


module.exports = {
  encrypt,
  decrypt
};

