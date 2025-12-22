-- Diagnostic migration to find all foreign key constraints referencing auth.users
-- This will help us identify any constraints we might have missed

-- Create a temporary function to list all constraints
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== Foreign Key Constraints Referencing auth.users ===';
  
  FOR r IN (
    SELECT 
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name,
      pg_get_constraintdef(c.oid) as constraint_definition
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN pg_constraint c ON c.conname = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'users'
      AND ccu.table_schema = 'auth'
    ORDER BY tc.table_name, kcu.column_name
  ) LOOP
    RAISE NOTICE 'Table: %, Column: %, Constraint: %, Definition: %', 
      r.table_name, r.column_name, r.constraint_name, r.constraint_definition;
  END LOOP;
END $$;

