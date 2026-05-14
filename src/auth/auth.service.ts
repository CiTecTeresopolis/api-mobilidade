import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from './email.service';
import { randomUUID } from 'crypto';
import { SupabaseService } from 'src/supabase/supabase.service';

@Injectable()
export class AuthService {
  // Removida a variável local "supabase: any" para evitar conflitos
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {
    console.log('✅ AuthService inicializado com SupabaseService');
  }

  async verifyEmail(userId: string) {
    const { data, error } = await this.supabaseService.client
      .from('drivers')
      .update({ email_confirmed: true })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('❌ Erro do Supabase no Update:', error.message);
      throw new BadRequestException('Erro ao atualizar status no banco.');
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ Usuário não encontrado na tabela drivers.');
    } else {
      console.log('✅ Sucesso! Usuário confirmado no banco.');
    }
  }

  // --- CADASTRO E LOGIN DE PASSAGEIROS ---

  async registerPassenger(
    email: string,
    pass: string,
    name: string,
    serviceType: string = 'passageiro',
  ) {
    const emailLimpo = email.toLowerCase().trim();
    const nomeLimpo = name.trim();

    if (!nomeLimpo.includes(' ')) {
      throw new BadRequestException('Por favor, digite seu nome completo.');
    }

    const { data: pExist } = await this.supabaseService.client
      .from('passengers')
      .select('email')
      .eq('email', emailLimpo)
      .maybeSingle();

    const { data: dExist } = await this.supabaseService.client
      .from('drivers')
      .select('email')
      .eq('email', emailLimpo)
      .maybeSingle();

    if (pExist || dExist) {
      throw new BadRequestException(
        'Este e-mail já está cadastrado no sistema.',
      );
    }

    const { data: authData, error: authError } =
      await this.supabaseService.client.auth.signUp({
        email: emailLimpo,
        password: pass,
      });

    if (authError) {
      throw new BadRequestException(authError.message);
    }

    if (!authData.user) {
      throw new BadRequestException('Usuário não criado.');
    }

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const token = randomUUID();
      const { error: dbError } = await this.supabaseService.client
        .from('passengers')
        .upsert({
          id: authData.user.id,
          name: nomeLimpo,
          email: emailLimpo,
          tipo_servico: serviceType,
          email_confirmed: false,
          email_token: token,
        });

      if (!dbError) {
        const confirmLink = `https://pilgrimatic-nita-scenographically.ngrok-free.dev/api/auth/confirm-email?token=${token}`;

        try {
          await this.emailService.sendConfirmationEmail(
            emailLimpo,
            confirmLink,
          );
        } catch (err) {
          console.error('Erro ao enviar email:', err);
        }

        return {
          message: 'Cadastro realizado! Verifique seu e-mail para confirmar.',
        };
      }

      if (dbError.code === '23503') {
        attempts++;
        await new Promise((res) => setTimeout(res, 1000));
        continue;
      }

      await this.supabaseService.client.auth.admin.deleteUser(authData.user.id);
      throw new BadRequestException(dbError.message);
    }

    await this.supabaseService.client.auth.admin.deleteUser(authData.user.id);
    throw new BadRequestException('Erro ao criar usuário.');
  }

  async confirmEmail(token: string) {
  // LOG 1: Verificar se o token chegou na API
  console.log('--- INICIANDO CONFIRMAÇÃO ---');
  console.log('Token recebido:', token);

  if (!token || token === 'undefined') {
    console.error('Erro: Token vazio ou undefined');
    throw new BadRequestException('Token inválido.');
  }

  // 1. TENTA BUSCAR EM PASSAGEIROS
  let { data: user, error: pError } = await this.supabaseService.client
    .from('passengers')
    .select('id, email_confirmed')
    .eq('email_token', token)
    .maybeSingle();

  let tabelaDestino: 'passengers' | 'drivers' = 'passengers';

  // 2. SE NÃO ACHOU, TENTA EM MOTORISTAS
  if (!user) {
    console.log('Não encontrado em passageiros, tentando motoristas...');
    
    const { data: driver, error: dError } = await this.supabaseService.client
      .from('drivers')
      .select('id, email_confirmed')
      .eq('email_token', token) // <-- VERIFIQUE SE O NOME DA COLUNA NO BANCO DRIVERS É ESTE MESMO!
      .maybeSingle();

    if (driver) {
      user = driver;
      tabelaDestino = 'drivers';
      console.log('Usuário encontrado na tabela de motoristas!');
    }
  } else {
    console.log('Usuário encontrado na tabela de passageiros!');
  }

  // 3. SE NÃO ACHOU EM NENHUMA DAS DUAS
  if (!user) {
    console.error('ERRO CRÍTICO: Token não existe em nenhuma tabela.');
    throw new BadRequestException('Token inválido.');
  }

  // 4. FAZ O UPDATE
  const { error: updateError } = await this.supabaseService.client
    .from(tabelaDestino)
    .update({ 
      email_confirmed: true, 
      email_token: null 
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('Erro no Update do Supabase:', updateError);
    throw new BadRequestException('Erro ao atualizar banco.');
  }

  console.log(`Sucesso! E-mail de ${tabelaDestino} confirmado.`);
  return { message: 'Sucesso' };
}

  // --- CADASTRO E GESTÃO DE MOTORISTAS ---

  async register(email: string, pass: string, additionalData: any) {
    const emailLimpo = email.toLowerCase().trim();
    const token = randomUUID();

    if (!pass || pass.length < 6) throw new BadRequestException('Senha curta.');

    const { data: dExist } = await this.supabaseService.client
      .from('drivers')
      .select('email')
      .eq('email', emailLimpo)
      .maybeSingle();

    if (dExist) throw new BadRequestException('E-mail já cadastrado.');

    const { data, error } = await this.supabaseService.client.auth.signUp({
      email: emailLimpo,
      password: pass,
    });

    if (error) throw new BadRequestException(error.message);
    const user = data.user;
    if (!user) throw new BadRequestException('Falha ao criar usuário.');

    const capitalize = (text: string) => {
      if (!text) return '';
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    };

    const { error: dbError } = await this.supabaseService.client
      .from('drivers')
      .upsert({
        id: user.id,
        name: additionalData.name,
        email: emailLimpo,
        cnh: additionalData.cnh,
        placa: additionalData.placa,
        modelo: additionalData.veiculo_modelo,
        tipo_servico: capitalize(additionalData.tipo_servico || 'motorista'),
        email_confirmed: false,
        email_token: token,
      });

    if (dbError) {
      await this.supabaseService.client.auth.admin.deleteUser(user.id);
      throw new BadRequestException(`Erro no banco: ${dbError.message}`);
    }

    const ngrokUrl = 'https://pilgrimatic-nita-scenographically.ngrok-free.dev';
    // O final da URL DEVE ser ?token= e não ?userId=
    const confirmLink = `${ngrokUrl}/api/auth/confirm-email?token=${token}`;

    await this.emailService.sendDriverConfirmationEmail(
      emailLimpo,
      confirmLink,
    );

    return { message: 'Cadastro realizado! Verifique seu e-mail.' };
  }

  // --- UPLOAD DE DOCUMENTOS ---

  async uploadDriverDocuments(driverId: string, files: any) {
    console.log('🟡 Iniciando upload para o Motorista:', driverId);

    const updateData: any = {
      ativo: false,
      status: 'ANALYSIS',
    };

    const fields = [
      { key: 'cnh', column: 'cnh_url' },
      { key: 'selfie', column: 'selfie_url' },
      { key: 'alvara', column: 'alvara_url' },
      { key: 'crlv', column: 'crlv_url' },
      { key: 'curso', column: 'curso_url' },
      { key: 'cmc', column: 'cmc_url' },
      { key: 'crv', column: 'crv_url' },
    ];

    try {
      // 1. LIMPEZA PREVENTIVA: Usando o this.supabaseService.client
      const { data: filesInFolder } = await this.supabaseService.client.storage
        .from('uploads')
        .list(driverId);

      if (filesInFolder && filesInFolder.length > 0) {
        const paths = filesInFolder.map((f) => `${driverId}/${f.name}`);
        await this.supabaseService.client.storage.from('uploads').remove(paths);
        console.log('🧹 Pasta do motorista limpa no Storage');
      }

      // 2. LOOP DE UPLOAD
      for (const field of fields) {
        if (files[field.key]) {
          const file = files[field.key][0];
          const fileExt = file.originalname.split('.').pop();

          // NOME FIXO: Essencial para que o upsert funcione e substitua o arquivo
          const fileName = `${driverId}/${field.key}.${fileExt}`;

          const { error: uploadError } =
            await this.supabaseService.client.storage
              .from('uploads')
              .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true,
                cacheControl: '0',
              });

          if (uploadError) {
            console.error(
              `❌ Erro no upload de ${field.key}:`,
              uploadError.message,
            );
            continue;
          }

          const { data: urlData } = this.supabaseService.client.storage
            .from('uploads')
            .getPublicUrl(fileName);

          // Adicionamos um query param de tempo na URL para forçar o App a atualizar a imagem
          updateData[field.column] = `${urlData.publicUrl}?t=${Date.now()}`;
          console.log(`✅ ${field.key} atualizado: ${fileName}`);
        }
      }

      // 3. ATUALIZAÇÃO NO BANCO DE DADOS: Usando o this.supabaseService.client
      const { error: dbError } = await this.supabaseService.client
        .from('drivers')
        .update(updateData)
        .eq('id', driverId);

      if (dbError) {
        throw new Error(`Erro ao atualizar banco: ${dbError.message}`);
      }

      return {
        success: true,
        message: 'Documentos substituídos e enviados para análise!',
      };
    } catch (err: any) {
      console.error('💥 Falha Geral no Processo:', err.message);
      throw new BadRequestException(err.message);
    }
  }

  // --- LOGIN ---

  async login(email: string, password: string) {
    const { data, error } =
      await this.supabaseService.client.auth.signInWithPassword({
        email,
        password,
      });

    if (error) throw new BadRequestException(error.message);

    let { data: profile } = await this.supabaseService.client
      .from('drivers')
      .select('id, tipo_servico, name, status, email_confirmed')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profile) {
    const { data: passengerProfile } = await this.supabaseService.client
      .from('passengers')
      .select('id, name, email_confirmed')
      .eq('id', data.user.id)
      .maybeSingle();

    if (passengerProfile) {
      profile = {
        ...passengerProfile,
        tipo_servico: 'PASSAGEIRO',
        status: 'ACTIVE', // Define como ativo por padrão se for passageiro encontrado
      };
    }
  }

    if (!profile) {
    throw new BadRequestException(
      'Perfil de usuário não encontrado no sistema.',
    );
  }

  // 2. Verifica se o e-mail foi confirmado
  // Se o valor for false, null ou undefined, ele barra o usuário aqui
  if (!profile.email_confirmed) {
    throw new BadRequestException(
      'Sua conta ainda não foi ativada. Por favor, verifique seu e-mail para validar sua conta.',
    );
  }

  if (!profile)
    throw new BadRequestException(
      'Perfil de usuário não encontrado no sistema.',
    );

    const token = this.jwtService.sign({
      sub: data.user.id,
      email: data.user.email,
      role: profile.tipo_servico,
    });

    return {
      access_token: token,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: profile.name || 'Usuário',
        tipo_servico: profile.tipo_servico,
        status: profile.status,
      },
    };
  }

  async loginSeguranca(matricula: string, password: string) {
    const { data: seguranca, error } = await this.supabaseService.client
      .from('security')
      .select('*')
      .eq('matricula', String(matricula).trim())
      .eq('password', String(password).trim())
      .maybeSingle();

    if (error || !seguranca)
      throw new BadRequestException('Matrícula ou senha incorretos.');

    return {
      access_token: this.jwtService.sign({
        sub: seguranca.id,
        role: 'security',
      }),
      user: {
        id: seguranca.id,
        name: seguranca.name,
        tipo_servico: 'SEGURANÇA',
      },
    };
  }

  async loginAdmin(email: string, password: string) {
    const { data, error } = await this.supabaseService.client
      .from('admins')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !data || data.password.trim() !== password.trim())
      throw new UnauthorizedException('Credenciais inválidas');

    return {
      token: this.jwtService.sign({
        sub: data.id,
        email: data.email,
        role: 'admin',
      }),
      user: { id: data.id, email: data.email, name: data.name, role: 'admin' },
    };
  }

  // --- UTILITÁRIOS ---

  async findDriverByCnh(cnh: string) {
    const { data, error } = await this.supabaseService.client
      .from('drivers')
      .select('*, ratings(stars)')
      .ilike('cnh', `%${cnh}%`);

    if (error) throw new BadRequestException('Erro ao consultar banco.');

    return (data || []).map((driver) => {
      const ratings = (driver as any).ratings || [];
      const total_reviews = ratings.length;
      const sumStars = ratings.reduce((acc, curr) => acc + curr.stars, 0);
      return {
        ...driver,
        rating_avg: total_reviews > 0 ? sumStars / total_reviews : 0,
        total_reviews,
      };
    });
  }

  async resetPassword(email: string) {
    const token = randomUUID();
    await this.supabaseService.client
      .from('drivers')
      .update({ email_token: token })
      .eq('email', email.toLowerCase().trim());
    const resetLink = `https://www.teresopolis.rj.gov.br/Painel-Mobilidade/index.html?alterar-senha=true&token=${token}`;
    await this.emailService.sendResetPasswordEmail(email, resetLink);
    return { message: 'E-mail de recuperação enviado!' };
  }

  async confirmPasswordReset(token: string, newPass: string) {
    // 1. Busca o motorista pelo token (isso já deve estar funcionando)
    const { data: driver, error: dbError } = await this.supabaseService.client
      .from('drivers')
      .select('id')
      .eq('email_token', token)
      .maybeSingle();

    if (dbError || !driver) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    // 2. AQUI ESTÁ O SEGREDO: Use o módulo .admin
    // O updateUserById é o único que permite trocar senha sem sessão ativa
    const { error: authError } =
      await this.supabaseService.client.auth.admin.updateUserById(driver.id, {
        password: newPass,
      });

    if (authError) {
      // Se o erro persistir aqui, o log vai nos dizer o porquê
      console.error('Erro Supabase Admin:', authError);
      throw new BadRequestException(
        `Erro ao atualizar senha: ${authError.message}`,
      );
    }

    // 3. Limpa o token após o sucesso
    await this.supabaseService.client
      .from('drivers')
      .update({ email_token: null })
      .eq('id', driver.id);

    return { message: 'Senha alterada com sucesso!' };
  }
}
