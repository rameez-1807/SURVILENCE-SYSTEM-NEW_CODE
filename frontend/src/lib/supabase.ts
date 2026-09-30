import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ofknpvaxynvokuzfkwds.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dFi-FFNPjCd77jj708hhNQ_xKts43nk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
