/*
# Create Default Admin and User Accounts

## Overview
Seeds two pre-built authentication accounts so the app works out of the box
without requiring sign-up. Mirrors the original demo credentials:
- admin / admin123  →  Administrator role
- user  / user123   →  Normal user role

## Changes
1. Inserts two rows into `auth.users` with bcrypt-hashed passwords.
2. The `handle_new_user` trigger auto-creates their `profiles` rows (both
   get 'user' role since they are not the first users).
3. Explicitly sets the admin profile's role to 'admin' and the user profile's
   role stays 'user'.
4. Sets profile usernames to 'admin' and 'user' respectively.

## Security Notes
- Passwords are hashed with bcrypt via pgcrypto's `crypt()` function.
- Email confirmation is bypassed (email_confirmed_at set to now()).
- These are shared demo credentials — all signed-in users see the same data.
*/

DO $$
DECLARE
  admin_id uuid;
  user_id uuid;
BEGIN
  -- Create admin account if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@ledgerly.app') THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      'admin@ledgerly.app',
      crypt('admin123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{"username": "admin"}'::jsonb,
      '',
      ''
    );
  ELSE
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@ledgerly.app';
  END IF;

  -- Create normal user account if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user@ledgerly.app') THEN
    user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      user_id,
      'authenticated',
      'authenticated',
      'user@ledgerly.app',
      crypt('user123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{}'::jsonb,
      '{"username": "user"}'::jsonb,
      '',
      ''
    );
  ELSE
    SELECT id INTO user_id FROM auth.users WHERE email = 'user@ledgerly.app';
  END IF;

  -- Ensure profiles exist and have correct roles + usernames
  INSERT INTO public.profiles (id, username, role)
  VALUES (admin_id, 'admin', 'admin')
  ON CONFLICT (id) DO UPDATE SET username = 'admin', role = 'admin';

  SELECT id INTO user_id FROM auth.users WHERE email = 'user@ledgerly.app';
  INSERT INTO public.profiles (id, username, role)
  VALUES (user_id, 'user', 'user')
  ON CONFLICT (id) DO UPDATE SET username = 'user', role = 'user';
END $$;
