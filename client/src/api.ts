// Central API configuration
// In production (Vercel), VITE_API_URL points to the Render server URL.
// In local dev, it defaults to empty string (same-origin) or is set in .env.development.
export const API_URL = import.meta.env.VITE_API_URL || '';
