import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersService } from 'src/users/users.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/schemas/user.schema';
import { UtilsModule } from 'src/utils/utils.module';
import { SpotifyService } from 'src/spotify/spotify.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UtilsModule
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, SpotifyService],
  exports: [AuthService]
})
export class AuthModule { }
