import {
  Controller,
  Get,
  UseGuards,
  Request,
  Param,
  NotFoundException, // Adicione este import
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// Instância global do Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

@Controller('drivers')
export class DriversController {
  @Get('search/:cnh')
  async findByCnh(@Param('cnh') cnh: string) {
    // Usamos 'supabase' direto, pois é uma constante fora da classe
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('cnh', cnh)
      .maybeSingle();

    if (error) {
      console.error('Erro na busca por CNH:', error.message);
      throw new NotFoundException('Erro ao consultar o banco de dados');
    }

    if (!data) {
      throw new NotFoundException('Motorista não cadastrado com este CNH');
    }

    return data;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Request() req) {
    console.log('Dados do usuário no Token:', req.user); // VERIFIQUE ISSO NO TERMINAL
    // AJUSTE CRÍTICO: O ID pode vir em 'sub' (padrão JWT/Supabase) ou 'id'
    const userId = req.user?.sub || req.user?.id;

    if (!userId) {
      console.error('JWT decodificado, mas sub/id não encontrado:', req.user);
      throw new NotFoundException('Usuário não identificado no token');
    }

    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', userId)
      .maybeSingle(); // maybeSingle não quebra se não achar nada

    if (error) {
      throw new NotFoundException('Erro ao consultar banco de dados');
    }

    // Se o usuário logou mas não tem cadastro na tabela 'drivers' ainda
    if (!data) {
      return {
        name: 'Motorista',
        status: 'NOT_SUBMITTED',
        ativo: false,
        address: 'Pendente',
      };
    }

    return data;
  }
}
