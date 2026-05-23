/**
 * Financial Input Formatting Helpers
 */

/**
 * Gets the thousand separator based on currency
 */
export const getThousandSeparator = (currency: string = "IDR"): string => {
  return currency === "IDR" ? "." : ",";
};

/**
 * Formats a raw number string or number into a thousand-separated string.
 * Supports integers for financial amounts.
 */
export const formatNumberWithSeparator = (value: string | number, currency: string = "IDR"): string => {
  const separator = getThousandSeparator(currency);
  
  // Clean value: keep only digits
  const cleanValue = String(value).replace(/\D/g, "");
  if (!cleanValue) return "";
  
  // Parse to integer
  const num = parseInt(cleanValue, 10);
  if (isNaN(num)) return "";
  
  // Format with the specified separator
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
};

/**
 * Parses a formatted thousand-separated string back to a raw number.
 */
export const parseFormattedNumber = (value: string, currency: string = "IDR"): number => {
  const separator = getThousandSeparator(currency);
  const escapedSeparator = separator === "." ? "\\." : separator;
  const regex = new RegExp(escapedSeparator, "g");
  
  // Remove all separators and keep only digits
  const cleanValue = value.replace(regex, "").replace(/\D/g, "");
  return parseInt(cleanValue, 10) || 0;
};
