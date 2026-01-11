/**
 * User Seed Script
 *
 * Usage: npx ts-node packages/database/scripts/seed-users.ts
 *
 * Or run via API: POST /api/auth/seed
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface UserSeed {
  email: string;
  password: string;
  name: string;
  role: 'super_admin' | 'company_admin' | 'manager' | 'store_manager' | 'staff';
}

const SEED_USERS: UserSeed[] = [
  {
    email: 'uhi1308@naver.com',
    password: 'Ghrnfldks12!!@',
    name: '슈퍼 관리자',
    role: 'super_admin',
  },
  {
    email: 'aaa@naver.com',
    password: '111111',
    name: '테스트 직원',
    role: 'staff',
  },
];

async function seedUsers() {
  console.log('🌱 Starting user seed...\n');

  for (const user of SEED_USERS) {
    console.log(`Creating user: ${user.email} (${user.role})`);

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (authError) {
        if (authError.message.includes('already been registered')) {
          console.log(`  ⚠️  User ${user.email} already exists in auth, skipping auth creation`);

          // Get existing user
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(u => u.email === user.email);

          if (existingUser) {
            // Update users table
            const { error: updateError } = await supabase
              .from('users')
              .upsert({
                auth_id: existingUser.id,
                email: user.email,
                name: user.name,
                role: user.role,
                status: 'ACTIVE',
              }, { onConflict: 'email' });

            if (updateError) {
              console.log(`  ❌ Failed to update users table: ${updateError.message}`);
            } else {
              console.log(`  ✅ Updated users table for ${user.email}`);
            }
          }
          continue;
        }
        throw authError;
      }

      // 2. Create user profile in users table
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          auth_id: authData.user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: 'ACTIVE',
        });

      if (profileError) {
        console.log(`  ⚠️  Profile error: ${profileError.message}`);
        // Try upsert
        await supabase
          .from('users')
          .upsert({
            auth_id: authData.user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: 'ACTIVE',
          }, { onConflict: 'email' });
      }

      console.log(`  ✅ Created: ${user.email}`);
    } catch (error) {
      console.error(`  ❌ Error creating ${user.email}:`, error);
    }
  }

  console.log('\n✨ Seed complete!');
}

// Run if called directly
seedUsers().catch(console.error);

export { seedUsers, SEED_USERS };
