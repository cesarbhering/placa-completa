/**
 * Input Validation Utilities
 * Prevents injection attacks and ensures data integrity
 */

/**
 * Validates email format (RFC 5321 compliant)
 * @param email Email address to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false
  }

  // Check length limits (RFC 5321)
  if (email.length > 254) {
    return false
  }

  const parts = email.split('@')
  if (parts.length !== 2) {
    return false
  }

  const [local, domain] = parts

  // Local part (before @) max 64 chars
  if (local.length > 64 || local.length === 0) {
    return false
  }

  // Domain part max 253 chars
  if (domain.length > 253 || domain.length === 0) {
    return false
  }

  // Basic format check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  return emailRegex.test(email)
}

/**
 * Validates Brazilian license plate format
 * Supports both old (ABC1234) and Mercosul (ABC1D23) formats
 * @param placa License plate to validate
 * @returns true if valid, false otherwise
 */
export function isValidPlate(placa: string): boolean {
  if (!placa || typeof placa !== 'string') {
    return false
  }

  // Remove any whitespace
  const cleanPlate = placa.trim().toUpperCase()

  // Check length
  if (cleanPlate.length !== 7) {
    return false
  }

  // Validate format: ABC1234 or ABC1D23
  const plateRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/

  return plateRegex.test(cleanPlate)
}

/**
 * Validates phone number (Brazilian format)
 * @param phone Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return true // Phone is optional
  }

  // Remove all non-numeric characters
  const cleanPhone = phone.replace(/\D/g, '')

  // Brazilian phone: 10 or 11 digits (with or without country code)
  if (cleanPhone.length < 10 || cleanPhone.length > 13) {
    return false
  }

  return true
}

/**
 * Sanitizes email to prevent email header injection
 * @param email Email to sanitize
 * @returns Sanitized email
 */
export function sanitizeEmail(email: string): string {
  // Remove any newlines, carriage returns, or null bytes
  return email.replace(/[\r\n\0]/g, '').trim()
}

/**
 * Validates base64 image data
 * @param base64 Base64 image string
 * @param maxSizeMB Maximum allowed size in MB
 * @returns true if valid, false otherwise
 */
export function isValidBase64Image(base64: string, maxSizeMB: number = 5): boolean {
  if (!base64 || typeof base64 !== 'string') {
    return false
  }

  // Check if it starts with data:image/
  if (!base64.startsWith('data:image/')) {
    return false
  }

  // Validate image format (only allow safe formats)
  const validFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif']
  const formatMatch = base64.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,/)

  if (!formatMatch || !validFormats.includes(formatMatch[1])) {
    return false
  }

  // Approximate size check (base64 is ~1.37x larger than binary)
  const base64Data = base64.split(',')[1]
  if (!base64Data) {
    return false
  }

  const sizeInBytes = (base64Data.length * 0.75)
  const sizeInMB = sizeInBytes / (1024 * 1024)

  if (sizeInMB > maxSizeMB) {
    return false
  }

  return true
}

/**
 * Sanitizes string to prevent XSS
 * @param str String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') {
    return ''
  }

  return str
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/[\r\n\0]/g, '') // Remove control characters
    .trim()
}

/**
 * Validates IP address format
 * @param ip IP address to validate
 * @returns true if valid, false otherwise
 */
export function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') {
    return false
  }

  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

  // IPv6 regex (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/

  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}
