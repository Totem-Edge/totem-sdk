import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Wallet passphrase input.
 *
 * The wallet password unlocks a local vault — it is never a website login, so
 * autofill and "save password" prompts are noise at best. LastPass in
 * particular ignores `data-lpignore` in current versions and overlays the
 * approval popup, hiding its buttons.
 *
 * The only reliable opt-out is to not present a `type="password"` field:
 * password managers look for that. This renders a text input masked with
 * `-webkit-text-security`, which Chromium and WebKit both support, and keeps
 * the per-manager ignore attributes for the ones that still honour them.
 */
export const WalletPasswordInput = React.forwardRef<HTMLInputElement, Props>(
  function WalletPasswordInput({ style, ...rest }, ref) {
    return (
      <input
        {...rest}
        ref={ref}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        // LastPass / 1Password / Bitwarden / Dashlane opt-outs
        data-lpignore="true"
        data-1p-ignore="true"
        data-bwignore="true"
        data-form-type="other"
        style={{ WebkitTextSecurity: "disc", ...style } as React.CSSProperties}
      />
    );
  },
);
