-- Check for triggers and constraints that might prevent user deletion

-- 1. Check for triggers on auth.users
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  RAISE NOTICE '=== Triggers on auth.users ===';
  FOR trigger_rec IN (
    SELECT 
      tgname AS trigger_name,
      tgrelid::regclass AS table_name,
      pg_get_triggerdef(oid) AS trigger_definition
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgisinternal = false
  ) LOOP
    RAISE NOTICE 'Trigger: %, Definition: %', trigger_rec.trigger_name, trigger_rec.trigger_definition;
  END LOOP;
END $$;

-- 2. Check ALL foreign key constraints (including in auth schema)
DO $$
DECLARE
  constraint_rec RECORD;
  constraint_count INT := 0;
BEGIN
  RAISE NOTICE '=== ALL Foreign Key Constraints Referencing auth.users ===';
  FOR constraint_rec IN (
    SELECT 
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      tc.constraint_name,
      pg_get_constraintdef(c.oid) as constraint_def,
      CASE 
        WHEN pg_get_constraintdef(c.oid) LIKE '%ON DELETE RESTRICT%' THEN 'RESTRICT'
        WHEN pg_get_constraintdef(c.oid) LIKE '%ON DELETE CASCADE%' THEN 'CASCADE'
        WHEN pg_get_constraintdef(c.oid) LIKE '%ON DELETE SET NULL%' THEN 'SET NULL'
        WHEN pg_get_constraintdef(c.oid) LIKE '%ON DELETE NO ACTION%' THEN 'NO ACTION'
        ELSE 'DEFAULT (RESTRICT)'
      END as delete_action
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
    ORDER BY tc.table_schema, tc.table_name, kcu.column_name
  ) LOOP
    constraint_count := constraint_count + 1;
    RAISE NOTICE 'Constraint #%: Schema=%, Table=%, Column=%, Name=%, Action=%, Definition=%', 
      constraint_count,
      constraint_rec.table_schema,
      constraint_rec.table_name,
      constraint_rec.column_name,
      constraint_rec.constraint_name,
      constraint_rec.delete_action,
      constraint_rec.constraint_def;
  END LOOP;
  
  IF constraint_count = 0 THEN
    RAISE NOTICE 'No foreign key constraints found referencing auth.users';
  ELSE
    RAISE NOTICE 'Total constraints found: %', constraint_count;
  END IF;
END $$;

