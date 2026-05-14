import {
  Controller,
  Param,
  Get,
  Post,
  Delete,
  Put,
  Body,
  UseInterceptors,
  UseGuards,
  Request,
  UploadedFiles,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  Req,
  Res,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { SupabaseService } from '../supabase/supabase.service'; // Certifique-se que o caminho está correto
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterUserDto } from '../users/dtos/register-user.dto';
import { LoginDto } from '../users/dtos/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get('drivers/category/:category')
  async getDriversByCategory(@Param('category') category: string) {
    const mapaCategorias = {
      Motorista1: 'Moto',
      Motorista2: 'Uber',
      Motorista3: 'Taxi',
      Motorista4: 'Van',
      Motorista5: 'Frete',
      Motorista6: 'Mudança',
    };

    const tipoNoBanco = mapaCategorias[category] || category;

    const { data, error } = await this.supabaseService.client
      .from('drivers')
      .select('*')
      .eq('tipo_servico', tipoNoBanco);

    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  @Post('login-seguranca')
  async loginSeguranca(@Body() body: any) {
    const { matricula, password } = body;
    if (!matricula || !password) {
      throw new UnauthorizedException('Matrícula e senha são obrigatórios');
    }
    return this.authService.loginSeguranca(matricula, password);
  }

  @Post('security/register')
  async registerSecurity(@Body() body: any) {
    try {
      const { error } = await this.supabaseService.client
        .from('security')
        .insert([
          {
            name: body.name,
            matricula: body.matricula,
            password: body.password,
          },
        ]);

      if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      return { success: true };
    } catch (err) {
      throw new HttpException(
        'Erro interno no servidor',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('security/:matricula')
  async getSecurityByMatricula(@Param('matricula') matricula: string) {
    const { data, error } = await this.supabaseService.client
      .from('security')
      .select('id, name, matricula')
      .eq('matricula', matricula)
      .maybeSingle();

    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    if (!data)
      throw new HttpException('Segurança não encontrado', HttpStatus.NOT_FOUND);

    return data;
  }

  @Post('register-passenger')
  async registerPassenger(@Body() body: any) {
    return await this.authService.registerPassenger(
      body.email,
      body.password,
      body.name,
      body.serviceType,
    );
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { email: string }) {
    if (!body.email) throw new BadRequestException('O e-mail é obrigatório');
    return this.authService.resetPassword(body.email);
  }

  @Post('confirm-reset-password')
  async confirmReset(@Body() body: { token: string; newPass: string }) {
    if (!body.token || !body.newPass) {
      throw new BadRequestException('Token e nova senha são obrigatórios');
    }
    return this.authService.confirmPasswordReset(body.token, body.newPass);
  }

  @Post('drivers/update-status')
  async updateDriverStatus(
    @Body() body: { id: string; status: string; ativo: boolean },
  ) {
    const { id, status, ativo } = body;

    const { data, error } = await this.supabaseService.client
      .from('drivers')
      .update({ status, ativo })
      .eq('id', id)
      .select();

    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return { success: true, data };
  }

  @Get('drivers/search/cnh/:cnh')
  async searchByCnh(@Param('cnh') cnh: string) {
    return this.authService.findDriverByCnh(cnh);
  }

  @Put('drivers/update')
  @UseGuards(JwtAuthGuard)
  async updateDriverProfile(@Request() req, @Body() body: any) {
    const userId = req.user.id || req.user.sub;
    const { name, email, password, modelo, placa, categoria } = body;

    try {
      // 1. Limpeza do Storage
      const { data: files } = await this.supabaseService.client.storage
        .from('driver-docs')
        .list(userId);

      if (files && files.length > 0) {
        const filesToRemove = files.map((file) => `${userId}/${file.name}`);
        await this.supabaseService.client.storage
          .from('driver-docs')
          .remove(filesToRemove);
      }

      // 2. Atualizar Drivers
      const { error: dbError } = await this.supabaseService.client
        .from('drivers')
        .update({
          name,
          email,
          modelo,
          placa: placa?.toUpperCase(),
          tipo_servico: categoria,
          status: 'PENDING',
          ativo: null,
        })
        .eq('id', userId);

      if (dbError) throw new Error(dbError.message);

      // 3. Atualizar Auth
      if (email || password) {
        const updateData: any = {};
        if (email) updateData.email = email;
        if (password) updateData.password = password;

        await this.supabaseService.client.auth.admin.updateUserById(
          userId,
          updateData,
        );
      }

      return { success: true, message: 'Perfil atualizado com sucesso.' };
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('notifications/all')
  async getAllNotifications() {
    // Alterado de 'supabase' para 'this.supabaseService.client'
    const { data, error } = await this.supabaseService.client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  @Get('notifications/unread-count/:driverId')
  async getUnreadNotificationsCount(@Param('driverId') driverId: string) {
    // TROCADO: Usando this.supabaseService.client para ignorar RLS no count
    const { data: notifications, error: fetchError } =
      await this.supabaseService.client
        .from('notifications')
        .select('id')
        .or(`driver_id.eq.${driverId},driver_id.is.null`);

    if (fetchError) throw new HttpException(fetchError.message, 400);

    // TROCADO: Usando this.supabaseService.client
    const { data: readIds, error: readError } =
      await this.supabaseService.client
        .from('notification_reads')
        .select('notification_id')
        .eq('driver_id', driverId);

    if (readError) throw new HttpException(readError.message, 400);

    const readSet = new Set((readIds || []).map((r) => r.notification_id));
    const unread = (notifications || []).filter((n) => !readSet.has(n.id));

    return { count: unread.length };
  }

  @Post('notifications/read-all/:driverId')
  async markAllAsRead(@Param('driverId') driverId: string) {
    const { data: allNotifs, error: fetchError } =
      await this.supabaseService.client
        .from('notifications')
        .select('id')
        .or(`driver_id.eq.${driverId},driver_id.is.null`);

    if (fetchError) throw new HttpException(fetchError.message, 400);

    if (allNotifs && allNotifs.length > 0) {
      const insertData = allNotifs.map((n) => ({
        notification_id: n.id,
        driver_id: driverId,
      }));

      const { error: upsertError } = await this.supabaseService.client
        .from('notification_reads')
        .upsert(insertData, { onConflict: 'notification_id, driver_id' });

      if (upsertError) throw new HttpException(upsertError.message, 400);
    }
    return { success: true };
  }

  @Post('notifications')
  async createNotification(@Body() body: any) {
    const { data, error } = await this.supabaseService.client
      .from('notifications')
      .insert([
        {
          driver_id: body.driver_id || null,
          title: body.title,
          message: body.message,
          type: body.type,
          read: false,
        },
      ])
      .select();

    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return { success: true, data };
  }

  @Delete('notifications/:id')
  async deleteNotification(@Param('id') id: string) {
    const { error } = await this.supabaseService.client
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw new HttpException(error.message, 400);
    return { success: true };
  }

  @Post('notifications/update/:id')
  async updateNotification(@Param('id') id: string, @Body() body: any) {
    const { error } = await this.supabaseService.client
      .from('notifications')
      .update({ title: body.title, message: body.message })
      .eq('id', id);

    if (error) throw new HttpException(error.message, 400);
    return { success: true };
  }

  @Get('drivers/:id')
  async getDriverPublic(@Param('id') id: string) {
    const { data, error } = await this.supabaseService.client
      .from('drivers')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    if (!data)
      throw new HttpException(
        'Motorista não encontrado.',
        HttpStatus.NOT_FOUND,
      );

    return data;
  }

  @Post('ratings')
  async createRating(@Body() body: any) {
    const { error } = await this.supabaseService.client
      .from('ratings')
      .insert([
        { driver_id: body.driverId, stars: body.stars, comment: body.comment },
      ]);

    if (error) throw new HttpException('Erro ao salvar avaliação', 400);
    return { success: true };
  }

  @Get('drivers/:id/ratings')
  async getDriverRatings(@Param('id') id: string) {
    const { data, error } = await this.supabaseService.client
      .from('ratings')
      .select('*')
      .eq('driver_id', id)
      .order('created_at', { ascending: false });

    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('admin/login')
  loginAdmin(@Body() body: any) {
    return this.authService.loginAdmin(body.email, body.password);
  }

 @Get('confirm-email')
async confirmEmail(@Query('token') token: string, @Res() res: Response) {
  try {
    // 1. Verificamos se o token existe antes de chamar o service
    if (!token) throw new Error('Token ausente');

    // 2. Chamamos o service passando o TOKEN
    await this.authService.confirmEmail(token); 

    // 3. Sucesso: Redireciona para o site da prefeitura
    return res.redirect(
      'https://www.teresopolis.rj.gov.br/Painel-Mobilidade/email-confirmado',
    );
  } catch (error: any) {
    console.error('Erro na confirmação:', error.message);
    // Erro: Redireciona para login com aviso de erro
    return res.redirect(
      'https://www.teresopolis.rj.gov.br/Painel-Mobilidade/index.html?erro=confirmacao',
    );
  }
}

  @Post('register')
  async register(@Body() body: RegisterUserDto) {
    return this.authService.register(body.email, body.password, body);
  }

  @Post('register/documents')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'cnh', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
      { name: 'alvara', maxCount: 1 },
      { name: 'crlv', maxCount: 1 },
      { name: 'curso', maxCount: 1 },
      { name: 'cmc', maxCount: 1 },
    ]),
  )
  async uploadDocs(@UploadedFiles() files: any, @Request() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.authService.uploadDriverDocuments(userId, files);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: any) {
    const driverId = req.user?.id || req.user?.sub;
    if (!driverId)
      throw new HttpException('Não autorizado', HttpStatus.UNAUTHORIZED);

    const { error } = await this.supabaseService.client
      .from('drivers')
      .delete()
      .eq('id', driverId);

    if (error)
      throw new HttpException('Erro ao excluir conta', HttpStatus.BAD_REQUEST);
    return { success: true, message: 'Conta excluída com sucesso' };
  }
}
