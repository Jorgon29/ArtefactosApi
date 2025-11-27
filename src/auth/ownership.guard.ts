import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const requestedUserId = request.params.id;

    if (user.isAdmin) {
      return true;
    }

    if (user.userId !== requestedUserId) {
      throw new ForbiddenException('You can only access your own data');
    }

    return true;
  }
}