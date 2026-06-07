-- Add image_url column to price_watches table
ALTER TABLE price_watches ADD COLUMN IF NOT EXISTS image_url TEXT;
