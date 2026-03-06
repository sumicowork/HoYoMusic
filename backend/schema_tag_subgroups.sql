-- Tag Sub-Groups Schema
-- Add parent_group_id to tag_groups to support nested group hierarchy

ALTER TABLE tag_groups
ADD COLUMN IF NOT EXISTS parent_group_id INTEGER REFERENCES tag_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tag_groups_parent ON tag_groups(parent_group_id);

COMMENT ON COLUMN tag_groups.parent_group_id IS 'Parent group ID for nested group hierarchy. NULL = top-level group.';

