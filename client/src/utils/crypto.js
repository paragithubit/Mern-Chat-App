/**
 * Utility functions for Client-Side End-to-End Encryption (E2EE)
 * using the browser-native Web Crypto API (window.crypto.subtle).
 */

// Safe helper to convert ArrayBuffer/Uint8Array to Base64 (avoids stack overflow on large messages)
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Safe helper to convert Base64 back to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// 1. Generate an Asymmetric Key Pair (RSA-OAEP) for the user
export async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

// 2. Export a CryptoKey (Public or Private) to a Base64 string for storage/transmission
export async function exportKey(key, format = "spki") {
  const exported = await window.crypto.subtle.exportKey(format, key);
  return arrayBufferToBase64(exported);
}

// 3. Import a Base64 string back into a usable CryptoKey object
export async function importKey(base64Key, format = "spki", usages = ["encrypt"]) {
  if (!base64Key) return null;
  const buffer = base64ToArrayBuffer(base64Key);

  const algorithm = { name: "RSA-OAEP", hash: "SHA-256" };

  return await window.crypto.subtle.importKey(
    format,
    buffer,
    algorithm,
    true,
    usages
  );
}

// 4. Hybrid Encryption: Encrypt plain text using AES-GCM, and lock the AES key with Recipient's RSA Public Key
export async function encryptText(plainText, recipientPublicKey) {
  if (!plainText) return "";
  
  // If no public key is available, fallback to plain text wrapped in object format
  if (!recipientPublicKey) {
    return JSON.stringify({ content: plainText, unencrypted: true });
  }

  try {
    // Generate random AES-GCM session key
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // Encrypt message content with AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedMessage = new TextEncoder().encode(plainText);
    const encryptedMessageBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encodedMessage
    );

    // Export raw AES key bytes
    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

    // Encrypt the AES key using recipient's RSA Public Key
    const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      recipientPublicKey,
      rawAesKey
    );

    return JSON.stringify({
      content: arrayBufferToBase64(encryptedMessageBuffer),
      key: arrayBufferToBase64(encryptedAesKeyBuffer),
      iv: arrayBufferToBase64(iv),
    });
  } catch (error) {
    console.error("Encryption error:", error);
    return plainText; // Fallback
  }
}

// 5. Decrypt message payload using local RSA Private Key and AES session key
export async function decryptText(encryptedPayloadString, privateKey) {
  if (!encryptedPayloadString) return "";

  try {
    const payload = JSON.parse(encryptedPayloadString);

    // Handle unencrypted fallback messages gracefully
    if (payload.unencrypted) {
      return payload.content;
    }

    if (!payload.content || !payload.key || !payload.iv || !privateKey) {
      return encryptedPayloadString;
    }

    const encryptedMessageBuffer = base64ToArrayBuffer(payload.content);
    const encryptedKeyBuffer = base64ToArrayBuffer(payload.key);
    const iv = base64ToArrayBuffer(payload.iv);

    // Decrypt AES session key with RSA Private Key
    const rawAesKeyBuffer = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedKeyBuffer
    );

    // Import decrypted AES key
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      rawAesKeyBuffer,
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );

    // Decrypt message text
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      aesKey,
      encryptedMessageBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error("Decryption error:", error);
    return "[Encrypted Message]";
  }
}