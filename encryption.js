// encryption.js - Data Security
class SecureStorage {
  static async encrypt(data, key = null) {
    if (!key) {
      key = await this.generateKey();
      // In a real extension, consider how securely this key itself is managed.
      // Storing it in chrome.storage.local is common but has implications
      // if the user's browser profile is compromised.
      // For this example, we'll proceed with storing it.
      const keyMaterial = await window.crypto.subtle.exportKey('raw', key);
      await chrome.storage.local.set({ encryptionKey: Array.from(new Uint8Array(keyMaterial)) });
    }

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));

    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Recommended IV size for AES-GCM
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );

    return {
      data: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv)
    };
  }

  static async decrypt(encryptedData, key) {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
      key,
      new Uint8Array(encryptedData.data)
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  }

  static async generateKey() {
    return await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  }

  static async getStoredKeyObject() {
    const result = await chrome.storage.local.get(['encryptionKey']);
    if (!result.encryptionKey) return null;
    return await window.crypto.subtle.importKey(
      'raw',
      new Uint8Array(result.encryptionKey),
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  }


  static async saveSecure(storageKey, data) {
    let key = await this.getStoredKeyObject();
    if (!key) {
      key = await this.generateKey();
      // Store the raw key material
      const keyMaterial = await window.crypto.subtle.exportKey('raw', key);
      await chrome.storage.local.set({ encryptionKey: Array.from(new Uint8Array(keyMaterial)) });
    }
    const encrypted = await this.encrypt(data, key);
    await chrome.storage.local.set({ [storageKey]: encrypted });
  }

  static async loadSecure(storageKey) {
    const key = await this.getStoredKeyObject();
    if (!key) {
        // console.log('No encryption key found. Cannot load secure data.');
        return null;
    }

    const result = await chrome.storage.local.get([storageKey]);
    if (!result[storageKey]) {
        // console.log(`No data found for key: ${storageKey}`);
        return null;
    }

    try {
        return await this.decrypt(result[storageKey], key);
    } catch (error) {
        console.error('Decryption failed:', error);
        // Potentially handle key corruption or data tampering, e.g., by clearing the problematic data.
        return null;
    }
  }
}
