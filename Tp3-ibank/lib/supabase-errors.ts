export const mapSupabaseError = (error: any): string => {
  if (!error) return 'Ocurrió un error inesperado.';

  // Extraemos el mensaje original o el status
  const code = error.code || error.name;
  const message = (error.message || '').toLowerCase();

  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    // Regla anti-enumeración estricta
    return 'Email o contraseña incorrectos';
  }

  if (message.includes('email not confirmed')) {
    return 'Debes confirmar tu email antes de iniciar sesión.';
  }

  if (message.includes('rate limit') || message.includes('too many requests') || code === '429') {
    return 'Demasiados intentos. Por favor, esperá un minuto y volvé a intentar.';
  }

  if (message.includes('weak_password')) {
    return 'La contraseña es muy débil. Debe cumplir con los requisitos.';
  }

  if (message.includes('user already exists') || message.includes('already registered')) {
    // Regla anti-enumeración de registro: la UI va a ignorar esto en Signup y mostrar éxito neutro,
    // pero si lo necesitamos como fallback, devolvemos un genérico.
    return 'No se pudo completar el registro.';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Error de conexión. Revisá tu internet.';
  }

  // Fallback
  return 'Ocurrió un error inesperado. Intentá más tarde.';
};
