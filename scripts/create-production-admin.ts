#!/usr/bin/env ts-node
/**
 * One-time script to create a super-admin account in production database
 * 
 * The production database is Replit's managed Neon PostgreSQL.
 * Both the Replit environment and Railway API connect to the same Neon instance.
 * 
 * Usage (from Replit):
 *   ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npx ts-node scripts/create-production-admin.ts
 * 
 * Usage (external, with explicit DB URL):
 *   DATABASE_URL="postgres://..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npx ts-node scripts/create-production-admin.ts
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

interface CreateAdminOptions {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function createSuperAdmin(options: CreateAdminOptions): Promise<void> {
  // Use DATABASE_URL from environment (Replit/Neon connection string)
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL environment variable is required');
    console.error('   This should already be available in your Replit environment.');
    console.error('   If running externally, set DATABASE_URL to your Neon PostgreSQL connection string.');
    process.exit(1);
  }

  if (!options.email || !options.password) {
    console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD are required');
    process.exit(1);
  }

  // Connect to production database with SSL
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false // Render requires SSL
    }
  });

  try {
    console.log('🔌 Connecting to production database (Neon PostgreSQL)...');
    await pool.query('SELECT 1');
    console.log('✅ Connected to production database (Neon)');

    // Check if user already exists
    console.log(`\n🔍 Checking if user ${options.email} already exists...`);
    const existingUser = await pool.query(
      'SELECT id, email, role, status FROM users WHERE email = $1',
      [options.email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      console.log(`\n⚠️  User already exists:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      
      console.log('\n❓ Do you want to update this user to super_admin? (y/n)');
      
      // For non-interactive script, we'll just update if FORCE_UPDATE=true
      if (process.env.FORCE_UPDATE === 'true') {
        console.log('🔄 FORCE_UPDATE=true, updating user to super_admin...');
        
        const passwordHash = await hashPassword(options.password);
        
        await pool.query(
          `UPDATE users 
           SET role = 'super_admin',
               status = 'active',
               email_verified = true,
               password_hash = $1,
               updated_at = NOW()
           WHERE email = $2`,
          [passwordHash, options.email.toLowerCase()]
        );
        
        console.log('✅ User updated to super_admin successfully!');
      } else {
        console.log('💡 To force update, run with FORCE_UPDATE=true');
        process.exit(0);
      }
    } else {
      // Create new super-admin user
      console.log('\n🔐 Hashing password...');
      const passwordHash = await hashPassword(options.password);
      console.log('✅ Password hashed');

      console.log('\n👤 Creating super-admin account...');
      const result = await pool.query(
        `INSERT INTO users (
          email,
          password_hash,
          first_name,
          last_name,
          role,
          status,
          email_verified,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, email, role, status, created_at`,
        [
          options.email.toLowerCase(),
          passwordHash,
          options.firstName || 'Admin',
          options.lastName || 'User',
          'super_admin',
          'active',
          true // Email pre-verified for admin
        ]
      );

      const newUser = result.rows[0];
      console.log('\n✅ Super-admin account created successfully!');
      console.log('\n📋 Account Details:');
      console.log(`   ID: ${newUser.id}`);
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Role: ${newUser.role}`);
      console.log(`   Status: ${newUser.status}`);
      console.log(`   Created: ${newUser.created_at}`);
    }

    console.log('\n🎉 Done! You can now log in to the dashboard with these credentials.');
    
  } catch (error: any) {
    console.error('\n❌ Error creating super-admin:');
    console.error(error.message);
    
    if (error.code === '23505') {
      console.error('\n💡 This email already exists. Use FORCE_UPDATE=true to update the existing user.');
    } else if (error.code === '42P01') {
      console.error('\n💡 The users table does not exist. Make sure migrations have run on production.');
      console.error('   Check if your Railway API service has run the database migrations.');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Parse command line arguments
const options: CreateAdminOptions = {
  email: process.env.ADMIN_EMAIL || '',
  password: process.env.ADMIN_PASSWORD || '',
  firstName: process.env.ADMIN_FIRST_NAME,
  lastName: process.env.ADMIN_LAST_NAME
};

// Run the script
createSuperAdmin(options).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
