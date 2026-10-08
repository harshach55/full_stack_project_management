import * as SecureStore from 'expo-secure-store';
import type { TokenStore } from './session-controller';

const TOKEN_KEY = 'pm.session.token';

/**
 * The only place the JWT is stored: Expo SecureStore, which on Android encrypts values with
 * a key kept in the Android Keystore. Never AsyncStorage or plain files (AUTH-10, MOB-09).
 * The token is never logged.
 */
export const secureTokenStore: TokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token) => SecureStore.setItemAsync(TOKEN_KEY, token),
  remove: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
