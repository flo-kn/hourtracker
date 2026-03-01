-- Add status column to timesheets table
ALTER TABLE timesheets 
ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress' 
CHECK (status IN ('in_progress', 'completed'));

-- Add index for status filtering
CREATE INDEX idx_timesheets_status ON timesheets(status);
