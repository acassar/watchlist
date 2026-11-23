import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GroupsModule } from '../groups/groups.module.js';
import { AccountService } from './account.service.js';
import { RetentionService } from './retention.service.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [AuthModule, GroupsModule],
  controllers: [UsersController],
  providers: [AccountService, RetentionService],
})
export class UsersModule {}
