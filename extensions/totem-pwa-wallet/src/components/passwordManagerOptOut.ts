/**
 * Props that stop password managers from treating the wallet passphrase as a
 * website credential.
 *
 * The wallet password unlocks a local vault — it is never a login to save or
 * autofill. LastPass in particular renders an overlay inside the page after the
 * field is used, which covers the approval popup (and its "Sign in" button).
 * Each manager needs its own opt-out attribute:
 *
 *   data-lpignore        LastPass
 *   data-1p-ignore       1Password
 *   data-bwignore        Bitwarden
 *   data-form-type       Dashlane
 *   autocomplete         "new-password" suppresses the save/update prompt
 */
export const walletPasswordInputProps = {
  autoComplete: "new-password",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;
