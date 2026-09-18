// ============================================================================
// Constants safe to import from ANYWHERE — including Edge Runtime code like
// middleware.ts. Never add a Node-only import (bcrypt, jsonwebtoken, the
// Supabase server client) to this file, or anything importing it will pull
// those in too and break on the Edge runtime.
// ============================================================================

export const AUTH_COOKIE_NAME = process.env.COOKIE_NAME || 'jasonex_session';
