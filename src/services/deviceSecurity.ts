/**
 * Trusted Device & Biometric Security Service
 * Restricts administrative access to up to 2 recognized devices (e.g. Lojista & Esposa)
 * Supports WebAuthn (Face ID / Touch ID / Biometria) and Device Fingerprinting.
 */

export interface TrustedDevice {
  id: string; // Unique device fingerprint
  name: string; // e.g. "Meu iPhone", "Celular Esposa"
  registeredAt: string;
  lastUsedAt: string;
  userAgent: string;
  platform: string;
  hasBiometrics: boolean;
}

export interface SecurityConfig {
  adminPin: string;
  strictDeviceLimit: boolean; // Only the 3 registered devices can access
  maxDevices: number; // 3: PC Lojista, Celular Lojista, Celular Esposa
  trustedDevices: TrustedDevice[];
  updatedAt: string;
}

const DEVICE_STORAGE_KEY = 'wh_store_device_id_v2';
const TRUSTED_DEVICES_LOCAL_KEY = 'wh_store_trusted_devices_v1';
const BIOMETRIC_CREDENTIAL_ID_KEY = 'wh_store_biometric_credential_id';

/**
 * Gets or creates a unique persistent fingerprint ID for the current device/browser.
 */
export function getCurrentDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!id) {
      const randomPart = Math.random().toString(36).substring(2, 12);
      const timePart = Date.now().toString(36);
      const screenPart = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
      id = `dev_${timePart}_${randomPart}_${screenPart}`;
      localStorage.setItem(DEVICE_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'fallback_device_id';
  }
}

/**
 * Detects human-friendly name for current device (e.g. "iPhone / Safari", "Android / Chrome")
 */
export function detectDeviceName(): string {
  if (typeof window === 'undefined') return 'Dispositivo';
  const ua = navigator.userAgent;
  let device = 'Computador';
  if (/iPhone/i.test(ua)) device = 'iPhone';
  else if (/iPad/i.test(ua)) device = 'iPad';
  else if (/Android/i.test(ua)) device = 'Android';
  else if (/Macintosh/i.test(ua)) device = 'Mac';
  else if (/Windows/i.test(ua)) device = 'Windows';

  let browser = 'Navegador';
  if (/CriOS|Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Edge';

  return `${device} (${browser})`;
}

/**
 * Checks if device hardware supports WebAuthn / Face ID / Touch ID / Biometrics
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads trusted devices list from LocalStorage / static fallback
 */
export function getLocalTrustedDevices(): TrustedDevice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRUSTED_DEVICES_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Erro ao carregar dispositivos locais:', err);
  }
  return [];
}

/**
 * Saves trusted devices list locally
 */
export function saveLocalTrustedDevices(devices: TrustedDevice[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRUSTED_DEVICES_LOCAL_KEY, JSON.stringify(devices.slice(0, 3)));
  } catch (err) {
    console.warn('Erro ao salvar dispositivos locais:', err);
  }
}

/**
 * Checks if current device is in the trusted devices list
 */
export function isCurrentDeviceRecognized(trustedDevices?: TrustedDevice[]): boolean {
  const currentId = getCurrentDeviceId();
  const list = trustedDevices || getLocalTrustedDevices();
  return list.some((d) => d.id === currentId);
}

/**
 * Registers the current device as one of the 3 authorized devices
 */
export function registerCurrentDevice(
  customName?: string,
  existingList?: TrustedDevice[],
  hasBiometrics: boolean = false
): { updatedList: TrustedDevice[]; success: boolean; message: string } {
  const currentId = getCurrentDeviceId();
  const list = existingList ? [...existingList] : getLocalTrustedDevices();

  // If already registered, update its timestamp and name
  const existingIndex = list.findIndex((d) => d.id === currentId);
  if (existingIndex >= 0) {
    list[existingIndex] = {
      ...list[existingIndex],
      name: customName || list[existingIndex].name || detectDeviceName(),
      lastUsedAt: new Date().toISOString(),
      hasBiometrics: hasBiometrics || list[existingIndex].hasBiometrics,
    };
    saveLocalTrustedDevices(list);
    return {
      updatedList: list,
      success: true,
      message: 'Dispositivo atual já estava reconhecido e foi atualizado com sucesso!',
    };
  }

  // If we already have 3 devices registered, cannot add a 4th without replacing
  if (list.length >= 3) {
    return {
      updatedList: list,
      success: false,
      message: 'Limite máximo de 3 dispositivos autorizados atingido. Remova um dispositivo antigo para autorizar este novo.',
    };
  }

  const newDevice: TrustedDevice = {
    id: currentId,
    name: customName || `Dispositivo ${list.length + 1} (${detectDeviceName()})`,
    registeredAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    platform: typeof navigator !== 'undefined' ? navigator.platform : '',
    hasBiometrics,
  };

  list.push(newDevice);
  saveLocalTrustedDevices(list);

  return {
    updatedList: list,
    success: true,
    message: `Dispositivo "${newDevice.name}" cadastrado como reconhecido com sucesso! (${list.length} de 3)`,
  };
}

/**
 * Removes a device from the recognized list
 */
export function revokeDevice(
  deviceId: string,
  existingList?: TrustedDevice[]
): TrustedDevice[] {
  const list = (existingList ? [...existingList] : getLocalTrustedDevices()).filter(
    (d) => d.id !== deviceId
  );
  saveLocalTrustedDevices(list);
  return list;
}

/**
 * Registers WebAuthn Biometrics (Face ID / Fingerprint / Passkey) for current device
 */
export async function registerBiometricPasskey(userName: string = 'Lojista WH Store'): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return { success: false, error: 'Biometria não suportada neste navegador.' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const creationOptions: CredentialCreationOptions = {
      publicKey: {
        challenge,
        rp: {
          name: 'WH Store Joias',
          id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        },
        user: {
          id: userId,
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Built-in platform (Face ID, Touch ID, Android Biometrics)
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      },
    };

    const credential = (await navigator.credentials.create(creationOptions)) as PublicKeyCredential | null;

    if (credential && credential.id) {
      localStorage.setItem(BIOMETRIC_CREDENTIAL_ID_KEY, credential.id);
      registerCurrentDevice(detectDeviceName(), undefined, true);
      return { success: true };
    }

    return { success: false, error: 'Credencial biométrica não gerada.' };
  } catch (err: any) {
    console.warn('Erro ao registrar biometria:', err);
    return { success: false, error: err?.message || 'Falha na captura biométrica.' };
  }
}

/**
 * Authenticates with native WebAuthn (Face ID / Touch ID / Biometrics)
 */
export async function authenticateWithBiometrics(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return { success: false, error: 'Biometria não disponível neste aparelho.' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_ID_KEY);

    const requestOptions: CredentialRequestOptions = {
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        ...(credentialId
          ? {
              allowCredentials: [
                {
                  id: Uint8Array.from(atob(credentialId.replace(/_/g, '/').replace(/-/g, '+')), (c) => c.charCodeAt(0)),
                  type: 'public-key',
                },
              ],
            }
          : {}),
      },
    };

    // Attempt authentication
    const assertion = await navigator.credentials.get(requestOptions);
    if (assertion) {
      return { success: true };
    }
    return { success: false, error: 'Autenticação biométrica cancelada ou não confirmada.' };
  } catch (err: any) {
    console.warn('Falha na autenticação biométrica:', err);
    // User cancelled or biometric prompt closed
    return { success: false, error: err?.message || 'Autenticação biométrica não concluída.' };
  }
}
