import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gruxwwqokscijzqxibht.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdydXh3d3Fva3NjaWp6cXhpYmh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxODQ4NzcsImV4cCI6MjA5Mjc2MDg3N30.exPbIcVgOMeM_3j9A1-l7qYqjmYOMR72sf45gwxOkqQ'

export const supabase = createClient(supabaseUrl, supabaseKey)
