/**
 * Capabilities that fail closed when their deployment configuration is
 * missing. Refusing to boot over one of them would take donations offline over
 * an email setting, so instead production logs, once at startup, which ones
 * are off and which variables they need. Names only — never values.
 */
export interface CapabilityConfiguration {
  /** Password reset, email verification, newsletter confirmation, security notices. */
  accountEmail: boolean;
  /** Authenticator (TOTP) enrollment. */
  mfa: boolean;
  /** Native App Store / Google Play subscriptions. */
  storeBilling: boolean;
}

export interface DisabledCapabilities {
  /** Expected to work in production; missing configuration is a fault. */
  faults: string[];
  /** Off by default until the owner deliberately enables it. */
  optional: string[];
}

export function disabledCapabilities(status: CapabilityConfiguration): DisabledCapabilities {
  const faults: string[] = [];
  const optional: string[] = [];
  if (!status.accountEmail) {
    faults.push(
      'account email (password reset, email verification, newsletter confirmation, password-changed notices): ' +
        'needs RESEND_API_KEY, FROM_EMAIL, AUTH_EMAIL_ENCRYPTION_KEY_BASE64 (32 bytes, base64) and an https PUBLIC_WEB_URL',
    );
  }
  if (!status.mfa) {
    faults.push('authenticator MFA enrollment: needs MFA_ENCRYPTION_KEY (32 bytes, standard base64)');
  }
  if (!status.storeBilling) {
    optional.push('native store billing (App Store / Google Play): STORE_BILLING_ENABLED is not "true"');
  }
  return { faults, optional };
}
