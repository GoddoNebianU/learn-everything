/**
 * AuthEvent action identifiers, written by better-auth databaseHooks.
 *
 * Uppercase namespace-verb form so records stay greppable in the
 * auth.authevent table. Free of runtime side-effects (no "use server") so it
 * can be imported from both server and client modules.
 */
export const AUTH_EVENT_ACTIONS = {
  SIGNUP: "AUTH.SIGNUP",
  LOGIN: "AUTH.LOGIN",
  LOGIN_FAILED: "AUTH.LOGIN_FAILED",
  LOGOUT: "AUTH.LOGOUT",
  DELETE_ACCOUNT: "AUTH.DELETE_ACCOUNT",
  PASSWORD_RESET_REQUEST: "AUTH.PASSWORD_RESET_REQUEST",
  EMAIL_VERIFY_SEND: "AUTH.EMAIL_VERIFY_SEND",
} as const;
