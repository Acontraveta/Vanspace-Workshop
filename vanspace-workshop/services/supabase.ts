import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Project, Task, Phase } from '../types';

// Supabase configuration storage keys
const SUPABASE_URL_KEY = 'VS_SUPABASE_URL';
const SUPABASE_KEY_KEY = 'VS_SUPABASE_KEY';

class SupabaseService {
  private client: SupabaseClient | null = null;
  public isConfigured: boolean = false;

  constructor() {
    this.initializeFromStorage();
  }

  private initializeFromStorage() {
    const url = localStorage.getItem(SUPABASE_URL_KEY);
    const key = localStorage.getItem(SUPABASE_KEY_KEY);
    
    if (url && key) {
      try {
        this.client = createClient(url, key);
        this.isConfigured = true;
        console.log('✅ Supabase initialized from storage');
      } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error);
        this.isConfigured = false;
      }
    } else {
      console.log('ℹ️ Running in LOCAL MODE (no Supabase config)');
    }
  }

  saveConfig(url: string, key: string) {
    localStorage.setItem(SUPABASE_URL_KEY, url);
    localStorage.setItem(SUPABASE_KEY_KEY, key);
    this.initializeFromStorage();
    window.location.reload();
  }

  resetConfig() {
    localStorage.removeItem(SUPABASE_URL_KEY);
    localStorage.removeItem(SUPABASE_KEY_KEY);
    this.client = null;
    this.isConfigured = false;
    window.location.reload();
  }

  // Auth methods
  auth = {
    signIn: async (email: string, password: string) => {
      if (!this.client) throw new Error('Supabase not configured');
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    },

    signOut: async () => {
      if (!this.client) return;
      await this.client.auth.signOut();
    },

    getSession: async () => {
      if (!this.client) return null;
      const { data } = await this.client.auth.getSession();
      return data.session;
    },
  };

  // Project CRUD
  projects = {
    getAll: async (): Promise<Project[] | null> => {
      if (!this.client) return null;
      const { data, error } = await this.client
        .from('projects')
        .select('*')
        .order('startDate', { ascending: false });
      
      if (error) {
        console.error('Error fetching projects:', error);
        return null;
      }
      return data as Project[];
    },

    create: async (project: Project) => {
      if (!this.client) return null;
      const { data, error } = await this.client
        .from('projects')
        .insert([project])
        .select();
      
      if (error) throw error;
      return data;
    },

    update: async (id: string, updates: Partial<Project>) => {
      if (!this.client) return null;
      const { data, error } = await this.client
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data;
    },

    delete: async (id: string) => {
      if (!this.client) return null;
      const { error } = await this.client
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
  };

  // Task CRUD
  tasks = {
    create: async (task: Partial<Task> & { phase_id: string }) => {
      if (!this.client) return null;
      const { data, error } = await this.client
        .from('tasks')
        .insert([task])
        .select();
      
      if (error) throw error;
      return data;
    },

    update: async (id: string, updates: Partial<Task>) => {
      if (!this.client) return null;
      const { data, error } = await this.client
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data;
    },

    delete: async (id: string) => {
      if (!this.client) return null;
      const { error } = await this.client
        .from('tasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
  };

  // Phase CRUD
  phases = {
    update: async (id: string, updates: Partial<Phase>) => {
      if (!this.client) return null;
      const { data, error } = await this.client
        .from('phases')
        .update(updates)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data;
    },
  };

  // Get supabase client for auth listeners
  getClient() {
    return this.client;
  }
}

// Export singleton instance
export const db = new SupabaseService();

// Create a placeholder supabase client that works even without config
// This prevents errors in auth listeners
const placeholderUrl = 'https://placeholder.supabase.co';
const placeholderKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = db.getClient() || createClient(placeholderUrl, placeholderKey);
