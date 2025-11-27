-- Check sequences table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'sequences'
ORDER BY ordinal_position;

-- Check if sequences table has user_id
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'sequences'
            AND column_name = 'user_id'
        ) THEN '✅ HAS user_id'
        ELSE '❌ MISSING user_id'
    END as user_id_status;

-- Check primary key
SELECT 
    tc.constraint_name,
    kc.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kc 
    ON tc.constraint_name = kc.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'sequences';

-- Count rows
SELECT COUNT(*) as row_count FROM sequences;


