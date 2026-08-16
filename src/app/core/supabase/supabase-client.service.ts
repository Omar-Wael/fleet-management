import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Single shared Supabase client instance for the whole app.
 * Inject this service instead of creating createClient() ad-hoc
 * in every feature service — avoids duplicate realtime sockets.
 */
@Injectable({
  providedIn: 'root',
})
export class SupabaseClientService {
  readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: { eventsPerSecond: 5 },
      },
    });
  }

  get instance(): SupabaseClient {
    return this.client;
  }
}
