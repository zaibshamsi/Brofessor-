
import { supabase } from './supabaseClient';
import { User } from '../types';

export const authService = {
  // Get the current user from the session, including their role
  getUser: async (): Promise<User | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    // Use a remote procedure call (RPC) to a database function to securely fetch the user's role.
    // This bypasses potential RLS policies that might block direct table access.
    const { data: role, error } = await supabase.rpc('get_my_role');

    if (error) {
      console.error("Error fetching user role via RPC:", error);
      // Fallback to default user role if the RPC call fails
      return { id: session.user.id, email: session.user.email!, role: 'user' };
    }
    
    return {
        id: session.user.id,
        email: session.user.email!,
        role: role || 'user',
    };
  },

  // Listen for authentication state changes
  onAuthStateChange: (callback: (user: User | null) => void) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userWithProfile = await authService.getUser();
        callback(userWithProfile);
      } else {
        callback(null);
      }
    });

    return subscription;
  },

  login: async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
  },

  register: async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
    });
    if (error) throw error;
    if (!data.user) throw new Error("Registration failed: No user returned.");
    // The onAuthStateChange listener will handle fetching the profile.
    return data.user;
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
