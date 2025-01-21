DO $$ 
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name != 'spatial_ref_sys'
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I CASCADE;', rec.table_name);
    END LOOP;

    FOR rec IN 
	    SELECT typname 
        FROM pg_type 
        WHERE typnamespace = 'public'::regnamespace
            AND typname NOT LIKE '\_%' ESCAPE '\'
            AND typname NOT IN (
            'spheroid', 'geometry_dump', 
            'geometry', 'spatial_ref_sys', 
            'geography',
            'box3d',
            'box2d',  
            'box2df',
            'gidx', 
            'geography_columns',
            'geometry_columns',
            'pg_stat_statements_info',
            'pg_stat_statements',
            'gtrgm',
            'valid_detail'
          )
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS %I CASCADE;', rec.typname);
    END LOOP;
END $$;
