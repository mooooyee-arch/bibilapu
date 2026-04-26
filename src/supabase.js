import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pmwsydhesdxvgyrwwjxy.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtd3N5ZGhlc2R4dmd5cnd3anh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxOTExMzUsImV4cCI6MjA5Mjc2NzEzNX0.6gqsL63eN8RSPoGVWPbwlh8r_MaJtY-Jxbl45XCua9o'

export const supabase = createClient(supabaseUrl, supabaseKey)
