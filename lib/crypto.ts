/**
 * Synchronous lightweight stream cipher (RC4-based) with Hex encoding.
 * Designed to work identically in browser and Node environments.
 */

function rc4(key: string, str: string): string {
  const s = new Array(256);
  let j = 0;
  let x;
  let res = "";

  for (let i = 0; i < 256; i++) {
    s[i] = i;
  }

  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    x = s[i];
    s[i] = s[j];
    s[j] = x;
  }

  let i = 0;
  j = 0;
  for (let y = 0; y < str.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    x = s[i];
    s[i] = s[j];
    s[j] = x;
    res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
  }
  return res;
}

export function encrypt(text: string | null | undefined, key: string): string {
  if (text === null || text === undefined) return "";
  const encrypted = rc4(key, text);
  let hex = "";
  for (let i = 0; i < encrypted.length; i++) {
    hex += encrypted.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return "enc_" + hex;
}

export function decrypt(cipherText: any, key: string): string {
  if (cipherText === null || cipherText === undefined) return "";
  const str = String(cipherText);
  if (!str.startsWith("enc_")) return str; // Return original if not encrypted
  
  try {
    const hex = str.substring(4);
    let encrypted = "";
    for (let i = 0; i < hex.length; i += 2) {
      encrypted += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
    }
    return rc4(key, encrypted);
  } catch (e) {
    console.error("Decryption error:", e);
    return str;
  }
}
