import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './jwt_payload.interface';

export const User = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload = request.user; 

    if (data) {
      return user[data];
    }
    
    return user;
  },
);