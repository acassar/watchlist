import { Module } from '@nestjs/common';
import { GroupMemberGuard } from './group-member.guard.js';
import { GroupsController } from './groups.controller.js';
import { GroupsService } from './groups.service.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';

@Module({
  controllers: [GroupsController, InvitationsController],
  providers: [GroupsService, InvitationsService, GroupMemberGuard],
  // Le guard « membre du groupe » sert aussi aux titres et aux statuts.
  exports: [GroupsService, GroupMemberGuard],
})
export class GroupsModule {}
