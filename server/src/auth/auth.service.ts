import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt'
import * as jwt from 'jsonwebtoken'
import * as SpotifyWebApi from 'spotify-web-api-node';


@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
  ) { }

  redirectUri = process.env.SPOTIFY_CALLBACK;
  clientId = process.env.SPOTIFY_CLIENTID;
  clientSecret = process.env.SPOTIFY_CLIENTSECRET;

  scopes = [
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'user-follow-read',
    "user-library-modify",
    "user-follow-modify"
  ];

  async login({ email, password }) {

    const user = await this.usersService.findOne({ id: "", email: email })

    if (!user) {
      throw new HttpException(
        '[AUTH/LOGIN] No user found with this email',
        HttpStatus.NOT_FOUND,
      );
    }

    const passwordTest = await new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, function (err, result) {
        if (err) {
          reject(err)
        }
        resolve(result)
      });
    })
    const emailTest = email === user.email

    if (!passwordTest || !emailTest) {
      throw new HttpException(
        '[AUTH/LOGIN] Wrong Password or Wrong Mail',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_PRIVATEKEY);

    return token
  }

  spotifyLogin(): string {
    const spotifyApi = new SpotifyWebApi({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: this.redirectUri,
    });

    const authorizeURL = spotifyApi.createAuthorizeURL(this.scopes);
    return authorizeURL;
  }

  async callback({ scope, state, code, appToken }) {
    if (!code) {
      throw new HttpException(
        '[SPOTIFY/CALLBACK] no code ',
        HttpStatus.NOT_FOUND,
      );
    }

    const spotifyApi = new SpotifyWebApi({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: this.redirectUri,
    });


    const responseAuth = await spotifyApi.authorizationCodeGrant(code);

    const { access_token, refresh_token, expires_in } = responseAuth.body

    const infosForUserAccountBinding = {
      spotify: {
        spotifyApi: spotifyApi,
        access_token: access_token,
        refresh_token: refresh_token,
        access_token_timeleft: expires_in
      },
      app: {
        app_token: appToken
      }
    }

    // BIND APP ACCOUNT AND SPOTIFY ACCOUNT
    await this.bindAppAccounts(infosForUserAccountBinding)

    return access_token;
  }

  private async bindAppAccounts({ spotify, app }) {
    const { access_token, refresh_token, spotifyApi, access_token_timeleft } = spotify
    const { app_token } = app

    spotifyApi.setAccessToken(access_token)
    spotifyApi.setRefreshToken(refresh_token)

    const spotifyAccount = await spotifyApi.getMe()
    const userId = this.getUserIdFromToken(app_token)

    const userInfos = {
      spotify: {
        spotify_id: spotifyAccount.body.id,
        email: spotifyAccount.body.email,
        access_token: access_token,
        access_token_timeleft: access_token_timeleft,
        refresh_token: refresh_token
      }
    }

    await this.usersService.update(userId, userInfos)
  }

  getUserIdFromToken(token: string): string {
    const verification = jwt.verify(token, process.env.JWT_PRIVATEKEY)
    const userId = verification.id || ""
    return userId
  }

}
