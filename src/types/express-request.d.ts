import { User } from '../users/schemas/user.schema'; // ou o caminho para o seu esquema de usuário

declare global {
  namespace Express {
    interface Request {
      user?: User; // ou { id: string } se você só injetar o ID
    }
  }
}