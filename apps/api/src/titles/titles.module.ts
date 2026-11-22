import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module.js';
import { MediaModule } from '../media/media.module.js';
import { TitlesController } from './titles.controller.js';
import { TitlesService } from './titles.service.js';

@Module({
  imports: [GroupsModule, MediaModule],
  controllers: [TitlesController],
  providers: [TitlesService],
})
export class TitlesModule {}
