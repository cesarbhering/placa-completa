/**
 * Composable para validação de formulários
 *
 * Fornece funções utilitárias para validação e formatação de
 * campos de formulário (placa e email)
 *
 * @returns {Object} Objeto com funções de validação e formatação
 */
export const useFormValidation = () => {
  /**
   * Formata uma placa removendo caracteres inválidos e convertendo para maiúsculas
   *
   * @param {string} value - Valor bruto da placa
   * @returns {string} Placa formatada (máximo 7 caracteres alfanuméricos)
   *
   * @example
   * formatPlaca('abc-1d23') // 'ABC1D23'
   */
  const formatPlaca = (value: string): string => {
    return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7)
  }

  /**
   * Valida formato de email
   *
   * @param {string} email - Email a ser validado
   * @returns {boolean} true se email for válido
   *
   * @example
   * validateEmail('user@example.com') // true
   * validateEmail('invalid') // false
   */
  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  /**
   * Valida formato de placa brasileira (Mercosul e antigo)
   *
   * Aceita formatos:
   * - Mercosul: ABC1D23 (3 letras, 1 número, 1 letra, 2 números)
   * - Antigo: ABC1234 (3 letras, 4 números)
   *
   * @param {string} placa - Placa a ser validada
   * @returns {boolean} true se placa for válida
   *
   * @example
   * validatePlaca('ABC1D23') // true
   * validatePlaca('ABC1234') // true
   * validatePlaca('AB1234') // false
   */
  const validatePlaca = (placa: string): boolean => {
    const clean = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(clean)
  }

  return {
    formatPlaca,
    validateEmail,
    validatePlaca,
  }
}
