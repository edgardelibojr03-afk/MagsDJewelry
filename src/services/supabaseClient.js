import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aoktzujkcqcpwmscwmkc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFva3R6dWprY3FjcHdtc2N3bWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NzEwNTAsImV4cCI6MjA3MTE0NzA1MH0.XYNnziC8Z1jKUJQ_TIMr4w2ExS7WiXKolBp61w4tb8s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
