export type AppErrorCode =
  | 'INVALID_LOGIN'
  | 'USER_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'ACCOUNT_DISABLED'
  | 'ORGANIZATION_SUSPENDED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'FIREBASE_CONFIG_ERROR'
  | 'FIRESTORE_PERMISSION_ERROR'
  | 'CLOUD_FUNCTION_ERROR'
  | 'UNKNOWN_ERROR';

export interface AppErrorResult {
  code: AppErrorCode;
  title: string;
  message: string;
}

export function parseFirebaseError(error: unknown, fallbackMessage?: string): AppErrorResult {
  const raw = error instanceof Error ? error.message : String(error || '');
  const lower = raw.toLowerCase();

  // Extract Firebase error code if embedded in message
  if (
    lower.includes('auth/invalid-credential') ||
    lower.includes('auth/wrong-password') ||
    lower.includes('auth/invalid-email')
  ) {
    return {
      code: 'INVALID_LOGIN',
      title: 'Invalid Credentials',
      message: 'The email/Login ID or password is incorrect. Please check and try again.',
    };
  }

  if (lower.includes('auth/user-not-found')) {
    return {
      code: 'USER_NOT_FOUND',
      title: 'Account Not Recognized',
      message: 'No matching account credentials were found. Verify your details or contact your administrator.',
    };
  }

  if (lower.includes('auth/user-disabled')) {
    return {
      code: 'ACCOUNT_DISABLED',
      title: 'Account Disabled',
      message: 'This account has been disabled or suspended by an administrator.',
    };
  }

  if (lower.includes('auth/operation-not-allowed')) {
    return {
      code: 'FIREBASE_CONFIG_ERROR',
      title: 'Sign-In Method Not Enabled',
      message:
        'Email/Password sign-in is not yet enabled in Firebase Console (Authentication -> Sign-in method). Use Google Sign-In or enable Email/Password.',
    };
  }

  if (lower.includes('auth/too-many-requests')) {
    return {
      code: 'INVALID_LOGIN',
      title: 'Too Many Attempts',
      message: 'Multiple failed attempts detected. Please wait a few minutes before trying again.',
    };
  }

  if (lower.includes('auth/network-request-failed') || lower.includes('the client is offline')) {
    return {
      code: 'NETWORK_ERROR',
      title: 'Network Connectivity Issue',
      message: 'Unable to reach authentication or database services. Check your connection and retry.',
    };
  }

  if (lower.includes('missing or insufficient permissions') || lower.includes('permission-denied')) {
    return {
      code: 'FIRESTORE_PERMISSION_ERROR',
      title: 'Access Denied',
      message: 'You do not have permission to perform this operation or access this tenant resource.',
    };
  }

  if (lower.includes('functions/')) {
    return {
      code: 'CLOUD_FUNCTION_ERROR',
      title: 'Backend Service Notice',
      message: fallbackMessage || 'The backend operation could not be completed at this moment.',
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    title: 'Operation Failed',
    message: fallbackMessage || (error instanceof Error ? error.message : 'An unexpected error occurred.'),
  };
}
