import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from './supabase.service';
import { createClient } from '@supabase/supabase-js';


// 1. Mock do módulo
jest.mock('@supabase/supabase-js');

// 2. Tipagem correta do createClient como um Mock do Jest
const mockedCreateClient = createClient as jest.Mock;

describe('SupabaseService', () => {
  let service: SupabaseService;

  // 3. Criamos os mocks individuais com tipos explícitos para evitar erro nas funções
  const signUpMock = jest.fn();
  const signInMock = jest.fn();

  const mockAuth = {
    auth: {
      signUp: signUpMock,
      signInWithPassword: signInMock,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // 4. Fazemos o createClient retornar o nosso objeto mockAuth
    // Usamos 'as any' para não ter que simular todas as centenas de funções do Supabase
    mockedCreateClient.mockReturnValue(mockAuth as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [SupabaseService],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register a user', async () => {
    // 5. Agora usamos as variáveis de mock diretamente (signUpMock)
    signUpMock.mockResolvedValue({
      data: { user: { email: 'test@example.com' } },
      error: null,
    });

    const result = await service.register('test@example.com', '123456');

    // O 'result' aqui vem do tipo de retorno do seu service
    expect(result.user?.email).toBe('test@example.com');
  });

  it('should login a user', async () => {
    signInMock.mockResolvedValue({
      data: { session: 'fake-session' },
      error: null,
    });

    const result = await service.login('test@example.com', '123456');
    
    // Verificação segura para o TS
    expect(result).toHaveProperty('session');
    expect((result as any).session).toBe('fake-session');
  });
});