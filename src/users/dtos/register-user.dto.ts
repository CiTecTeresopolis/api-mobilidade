import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class RegisterUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  name!: string;

  @IsString()
  cnh!: string;

  @IsString()
  tipo_servico!: string;

  @IsString()
  @IsNotEmpty()
  placa!: string;

  @IsString()
  @IsNotEmpty()
  veiculo_modelo!: string;
}