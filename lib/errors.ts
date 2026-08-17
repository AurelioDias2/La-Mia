/**
 * Extrai uma mensagem de erro segura (sempre string) de uma resposta de API.
 * Nunca retorna o objeto de erro do Zod diretamente — renderizar um objeto
 * como filho do React quebra a página inteira ("Application error: a
 * client-side exception has occurred").
 */
export function extractErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object" || !("error" in data)) return fallback;
  const err = (data as { error: unknown }).error;

  if (typeof err === "string") return err;
  if (!err || typeof err !== "object") return fallback;

  const flat = err as { formErrors?: unknown; fieldErrors?: Record<string, unknown> };
  if (Array.isArray(flat.formErrors) && typeof flat.formErrors[0] === "string") {
    return flat.formErrors[0];
  }
  if (flat.fieldErrors && typeof flat.fieldErrors === "object") {
    for (const messages of Object.values(flat.fieldErrors)) {
      if (Array.isArray(messages) && typeof messages[0] === "string") return messages[0];
    }
  }
  return fallback;
}
