import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ruzqqtuofqrteciulogw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1enFxdHVvZnFydGVjaXVsb2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3NTk3NTksImV4cCI6MjA2OTMzNTc1OX0.O1XZJ-fBjbfbXiUbgervKU0Tqt2n4O80bZgRU7Y0xYc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
