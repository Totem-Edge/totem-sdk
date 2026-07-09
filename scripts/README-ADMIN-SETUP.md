# Create Super-Admin Account in Production Database

## Architecture Clarification

Your production database is **Replit's managed Neon PostgreSQL**, not a Railway-managed database.

The architecture is:
- 🗄️ **Database:** Neon PostgreSQL (hosted by Replit, production-ready)
- 🚀 **API Backend:** Railway (connects to Neon via `DATABASE_URL` secret)
- 🌐 **Dashboard:** CloudFlare Pages
- ⚡ **Redis:** Upstash

The `DATABASE_URL` secret in your Replit environment **IS** your production database connection string. Both your local development and the deployed Railway API use the same Neon database.

## Quick Setup (From Replit - Recommended)

Since you're in Replit and `DATABASE_URL` is already configured, simply run:

```bash
ADMIN_EMAIL="gheeklabs@gmail.com" \
ADMIN_PASSWORD="YOUR_SECURE_PASSWORD_HERE" \
ADMIN_FIRST_NAME="Peter" \
ADMIN_LAST_NAME="Admin" \
npx ts-node scripts/create-production-admin.ts
```

**Replace:**
- `YOUR_SECURE_PASSWORD_HERE` → Your chosen secure password
  - At least 8 characters
  - Must include: uppercase, lowercase, numbers, and special characters
  - Example: `MySecure@Axia2025!`

That's it! The script will automatically use your Replit `DATABASE_URL` secret.

## Example

```bash
ADMIN_EMAIL="gheeklabs@gmail.com" \
ADMIN_PASSWORD="MySecure@Axia2025!" \
ADMIN_FIRST_NAME="Peter" \
ADMIN_LAST_NAME="Admin" \
npx ts-node scripts/create-production-admin.ts
```

## What It Does

1. ✅ Connects to your Neon PostgreSQL database (with SSL)
2. ✅ Checks if the user already exists
3. ✅ Hashes the password using bcrypt (12 rounds, same as registration)
4. ✅ Creates user with:
   - Email: gheeklabs@gmail.com
   - Role: `super_admin`
   - Status: `active`
   - Email verified: `true` (no verification needed)
5. ✅ Displays confirmation with user ID and details

## Expected Output

```
🔌 Connecting to production database (Neon PostgreSQL)...
✅ Connected to production database (Neon)

🔍 Checking if user gheeklabs@gmail.com already exists...

🔐 Hashing password...
✅ Password hashed

👤 Creating super-admin account...

✅ Super-admin account created successfully!

📋 Account Details:
   ID: 1
   Email: gheeklabs@gmail.com
   Role: super_admin
   Status: active
   Created: 2025-11-05T20:30:00.000Z

🎉 Done! You can now log in to the dashboard with these credentials.

🔌 Database connection closed
```

## Update Existing User

If the user already exists and you want to update them to super_admin with a new password:

```bash
ADMIN_EMAIL="gheeklabs@gmail.com" \
ADMIN_PASSWORD="MyNewSecure@Pass!" \
FORCE_UPDATE=true \
npx ts-node scripts/create-production-admin.ts
```

## Security Notes

⚠️ **IMPORTANT:**
- The `DATABASE_URL` secret is your production database - treat it carefully
- Never commit passwords to git
- Run this script only once to create the admin account
- Store your admin password in a secure password manager
- This creates an account in your **production** Neon database

## Troubleshooting

### Error: "DATABASE_URL environment variable is required"
→ The DATABASE_URL should be automatically available in Replit. Check your Secrets.

### Error: "User already exists"
→ Add `FORCE_UPDATE=true` to update the existing user with a new password and promote to super_admin.

### Error: "The users table does not exist"
→ Database migrations haven't run yet. Check:
  - Replit: Make sure the "Axia Backend API" workflow is running
  - Railway: Check your API service logs for "✅ PostgreSQL database migrated successfully"

### Connection errors
→ Verify that:
  - The DATABASE_URL secret is correctly set in Replit
  - Your Axia Backend API workflow is running (it should have run migrations)

## After Creation

Once the admin account is created:

### Option A: Test Locally (Replit)
1. Open the Webview in Replit
2. Go to the dashboard login
3. Log in with:
   - Email: `gheeklabs@gmail.com`
   - Password: The password you just set
4. You should have full super-admin access!

### Option B: Test on CloudFlare Pages (Production)
1. Make sure you've configured CloudFlare Pages environment variable:
   - `VITE_API_URL = https://api.axia.to`
2. Go to your CloudFlare Pages URL: `https://[your-project].pages.dev`
3. Log in with the same credentials
4. Full super-admin access! 🎉

## Database Information

Your production database (Neon PostgreSQL) is shared between:
- ✅ Replit development environment (this workspace)
- ✅ Railway API deployment (production)
- ✅ Any other services you configure with the same `DATABASE_URL`

This means when you create the admin account here in Replit, it's immediately available for login on your CloudFlare Pages production dashboard (once the API URL is configured).

## Clean Up

After creating the admin account, you can optionally delete this script:

```bash
rm scripts/create-production-admin.ts
rm scripts/README-ADMIN-SETUP.md
```

Or keep it for creating additional admin accounts in the future.
