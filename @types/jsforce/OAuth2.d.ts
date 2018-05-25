import { CallbackFunc, TokenResponse } from "./global";

export type OAuth2Options = {
    loginUrl?: string,
    authzServiceUrl?: string,
    tokenServiceUrl?: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
};


export class OAuth2 {
    constructor(options: OAuth2Options)
    authenticate(username: string, password: string, callback?: CallbackFunc<TokenResponse>): Promise<TokenResponse>
    getAuthorizationUrl(params: { scope: string, state: string }): string
    refreshToken(refreshToken: string, callback?: CallbackFunc<TokenResponse>): Promise<TokenResponse>
    requestToken(code: string, callback?: CallbackFunc<TokenResponse>): Promise<TokenResponse>
    revokeToken(accessToken: string, callback?: CallbackFunc<void>): Promise<void>
}