-- This script runs after GoTrue creates its tables
-- Grant additional permissions if needed

-- The auth.uid() function should already exist from GoTrue migrations
-- Just ensure our application roles have access

DO $$
BEGIN
  -- Grant execute permission on auth.uid() if it exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uid' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  END IF;
END
$$;

-- Grant permissions on auth tables to service_role (if tables exist)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'auth' LOOP
    EXECUTE 'GRANT ALL ON auth.' || quote_ident(r.tablename) || ' TO service_role';
    EXECUTE 'GRANT SELECT ON auth.' || quote_ident(r.tablename) || ' TO authenticated';
  END LOOP;
END
$$;

-- Grant permissions on auth sequences
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'auth' LOOP
    EXECUTE 'GRANT ALL ON auth.' || quote_ident(r.sequence_name) || ' TO service_role';
  END LOOP;
END
$$;
