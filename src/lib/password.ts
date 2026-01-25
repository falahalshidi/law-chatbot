/**
 * Password hashing utility using Web Crypto API
 * Uses PBKDF2 for secure password hashing
 */

/**
 * Hash a password using PBKDF2
 * @param password - Plain text password
 * @returns Hashed password with salt (format: salt:hash)
 */
export async function hashPassword(password: string): Promise<string> {
  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Convert password to ArrayBuffer
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  // Import password as key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // Derive key using PBKDF2
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // High iteration count for security
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 256 bits = 32 bytes
  );
  
  // Convert salt and hash to base64 strings
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  
  // Return format: salt:hash
  return `${saltBase64}:${hashBase64}`;
}

/**
 * Verify a password against a hash
 * @param password - Plain text password to verify
 * @param hashedPassword - Hashed password with salt (format: salt:hash)
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    // Split salt and hash
    const [saltBase64, hashBase64] = hashedPassword.split(':');
    
    if (!saltBase64 || !hashBase64) {
      return false;
    }
    
    // Convert base64 strings back to Uint8Array
    const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
    const storedHash = Uint8Array.from(atob(hashBase64), c => c.charCodeAt(0));
    
    // Convert password to ArrayBuffer
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    
    // Import password as key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    // Derive key using same parameters
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    // Compare hashes
    const computedHash = new Uint8Array(hashBuffer);
    
    if (computedHash.length !== storedHash.length) {
      return false;
    }
    
    for (let i = 0; i < computedHash.length; i++) {
      if (computedHash[i] !== storedHash[i]) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

