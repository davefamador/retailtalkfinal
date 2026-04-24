-- Migration V11: Add "removed" to products status CHECK constraint
-- Fixes 500 error when soft-deleting products that have transaction history.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check
    CHECK (status IN ('pending', 'approved', 'unapproved', 'pending_removal', 'removed'));
