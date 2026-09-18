// ============================================================================
// One-time script: creates the first login (CEO/Admin) user.
// The schema seeds *roles* but no users, so without this you have a DB
// with no one able to log in.
//
// Usage (after .env.local is filled in and `npm install` has run):
//   node scripts/create-admin.mjs "Owner Name" owner@example.com "StrongPassword123"
// ============================================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const [, , fullName, email, password] = process.argv;

if (!fullName || !email || !password) {
  console.error('Usage: node scripts/create-admin.mjs "Full Name" email@example.com password');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const { data: role, error: roleErr } = await db
    .from('roles')
    .select('id')
    .eq('name', 'CEO/Admin')
    .single();

  if (roleErr || !role) {
    console.error('Could not find the "CEO/Admin" role. Did you run db/schema.sql yet?', roleErr);
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { data: user, error: userErr } = await db
    .from('users')
    .insert({
      email,
      password_hash,
      full_name: fullName,
      role_id: role.id,
      is_active: true,
    })
    .select('id, email, full_name')
    .single();

  if (userErr) {
    console.error('Failed to create user:', userErr.message);
    process.exit(1);
  }

  console.log('Admin user created:');
  console.log(user);
  console.log('\nYou can now log in with this email and the password you provided.');
}

main();
