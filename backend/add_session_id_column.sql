-- Add session_id column to audit_logs table
ALTER TABLE arao.text_to_sql.audit_logs
ADD COLUMNS (
  session_id STRING COMMENT 'Session ID to group related events (business logic -> SQL generation -> execution)'
);
