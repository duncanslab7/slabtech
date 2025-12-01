-- ============================================================================
-- Slab Voice Database Schema
-- ============================================================================
-- This file contains the complete database schema for the Slab Voice application.
-- Run this SQL in your Supabase SQL Editor to set up the database.
-- ============================================================================

-- Table: transcripts
-- Stores the results of AssemblyAI transcription jobs
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  salesperson_name TEXT NOT NULL,
  customer_name TEXT,
  original_filename TEXT NOT NULL,
  file_storage_path TEXT NOT NULL, -- The path to the MP3 in Supabase Storage
  transcript_redacted JSONB,       -- AssemblyAI JSON result with transcript
  redaction_config_used TEXT NOT NULL -- e.g., 'person_name,location'
);

-- Table: redaction_config
-- A single-row table to store the current redaction settings
CREATE TABLE redaction_config (
  id INT PRIMARY KEY DEFAULT 1,
  pii_fields TEXT NOT NULL -- A comma-separated string for AssemblyAI, e.g., 'person_name,location'
);

-- Insert the initial default configuration
INSERT INTO redaction_config (pii_fields) VALUES ('all') ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
-- Enable RLS on tables (recommended for production)
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE redaction_config ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all transcripts
CREATE POLICY "Allow authenticated users to read transcripts"
ON transcripts
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to insert transcripts
CREATE POLICY "Allow authenticated users to insert transcripts"
ON transcripts
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow authenticated users to update transcripts
CREATE POLICY "Allow authenticated users to update transcripts"
ON transcripts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Allow authenticated users to delete transcripts
CREATE POLICY "Allow authenticated users to delete transcripts"
ON transcripts
FOR DELETE
TO authenticated
USING (true);

-- Policy: Allow authenticated users to read redaction config
CREATE POLICY "Allow authenticated users to read redaction config"
ON redaction_config
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to update redaction config
CREATE POLICY "Allow authenticated users to update redaction config"
ON redaction_config
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================================
-- Storage Bucket for Audio Files
-- ============================================================================
-- Create a storage bucket for audio files (run this in Supabase Dashboard > Storage)
-- Bucket name: 'audio-files'
-- Public: false
--
-- Then create policies for the bucket:
--
-- Allow authenticated users to upload files:
-- CREATE POLICY "Allow authenticated users to upload audio files"
-- ON storage.objects
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (bucket_id = 'audio-files');
--
-- Allow authenticated users to read files:
-- CREATE POLICY "Allow authenticated users to read audio files"
-- ON storage.objects
-- FOR SELECT
-- TO authenticated
-- USING (bucket_id = 'audio-files');
--
-- Allow authenticated users to delete files:
-- CREATE POLICY "Allow authenticated users to delete audio files"
-- ON storage.objects
-- FOR DELETE
-- TO authenticated
-- USING (bucket_id = 'audio-files');
