import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config.js';
import { GroupsModule } from './groups/groups.module.js';
import { HealthModule } from './health/health.module.js';
import { MailModule } from './mail/mail.module.js';
import { MediaModule } from './media/media.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TitlesModule } from './titles/titles.module.js';
import { PlaylistsModule } from './playlists/playlists.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    MediaModule,
    TitlesModule,
    PlaylistsModule,
    HealthModule,
  ],
})
export class AppModule {}
