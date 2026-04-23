import CryptoJS from 'crypto-js';

/**
 * Encrypts a string using AES
 */
export function encryptData(data: string, key: string): string {
  if (!data || !key) return data;
  return CryptoJS.AES.encrypt(data, key).toString();
}

/**
 * Decrypts a string using AES
 */
export function decryptData(encryptedData: string, key: string): string {
  if (!encryptedData || !key) return encryptedData;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption failed", error);
    return "";
  }
}

/**
 * Generates a random secure key if the user doesn't provide one
 */
export function generateSessionKey(): string {
  return CryptoJS.lib.WordArray.random(16).toString();
}
