import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async updateProfile(userId: string, data: { name?: string; email?: string }) {
    // No Supabase, atualizamos os dados do usuário assim:
    const { data: user, error } = await this.supabaseService.client.auth.admin.updateUserById(
      userId,
      { email: data.email, user_metadata: { name: data.name } }
    );

    if (error) throw new BadRequestException(error.message);

    return { message: 'Perfil atualizado com sucesso', user };
  }

  async updatePassword(userId: string, newPassword: string) {
    // O próprio Supabase faz o hash da senha para você!
    const { error } = await this.supabaseService.client.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) throw new BadRequestException(error.message);

    return { message: 'Senha atualizada com sucesso' };
  }
}