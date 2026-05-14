import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  // Mudamos para public para o AuthService conseguir acessar this.supabaseService.client
  public client: SupabaseClient;

  constructor(private configService: ConfigService) {
    // Buscamos as variáveis através do ConfigService (forma correta no NestJS)
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    console.log('--- DEBUG SUPABASE ---');
    console.log('URL carregada:', url);
    console.log('Tamanho da Key:', key?.length);
    console.log('Final da Key:', key?.substring(key.length - 5));
    console.log('----------------------');

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas no .env',
      );
    }

    // Inicializamos o cliente dentro do construtor
    this.client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    console.log('✅ Supabase Service conectado com Service Role!');
  }

  // Seus métodos de Auth podem usar o this.client agora
  async register(email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async login(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }
}
