-- Grant permissions to the queryforge app service principal
-- Service Principal: app-1i54xz queryforge (ID: 75918815530343)

-- Grant USAGE on catalog
GRANT USAGE ON CATALOG arao TO `app-1i54xz queryforge`;

-- Grant USAGE on schema
GRANT USAGE ON SCHEMA arao.text_to_sql TO `app-1i54xz queryforge`;

-- Grant SELECT on audit_logs table
GRANT SELECT ON TABLE arao.text_to_sql.audit_logs TO `app-1i54xz queryforge`;

-- Grant MODIFY on audit_logs table (for INSERT operations)
GRANT MODIFY ON TABLE arao.text_to_sql.audit_logs TO `app-1i54xz queryforge`;

-- Optionally, grant SELECT on all tables in the schema if the app needs to query other tables
GRANT SELECT ON SCHEMA arao.text_to_sql TO `app-1i54xz queryforge`;
