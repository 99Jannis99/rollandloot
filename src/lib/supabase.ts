import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://digpdyxoyxbmzypretli.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpZ3BkeXhveXhibXp5cHJldGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIxOTIyMTQsImV4cCI6MjA0Nzc2ODIxNH0.Jw-QZyz52jjmY9FzbaXhU9Kq3OnEg5W4yfcfbbyN5O4';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public'
  },
  auth: {
    persistSession: false
  }
});