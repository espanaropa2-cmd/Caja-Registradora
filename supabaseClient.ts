
import { createClient } from '@supabase/supabase-js';

// Tus credenciales fijas de Supabase
const supabaseUrl = 'https://usntjpbyfzrnyksuqqut.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzbnRqcGJ5Znpybnlrc3VxcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTc5NDEsImV4cCI6MjA4NDQzMzk0MX0.68o_2TqynXsU0LDPfCzi1T_PgsLTQCsXWIq6jM4r42M';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
