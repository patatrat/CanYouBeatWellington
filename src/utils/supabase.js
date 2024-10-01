import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aqonxggphwupteukhqvw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxb254Z2dwaHd1cHRldWtocXZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc3NDc4OTYsImV4cCI6MjA0MzMyMzg5Nn0.ZP0pRO6pcd2eyeKjH2v0oPPeDuJjs4xvOEsqzRshjvk'

export const supabase = createClient(supabaseUrl, supabaseKey)