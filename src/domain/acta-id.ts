// An acta number typed or pasted as an SNP link ("…/enfrentamiento/edit/54705/verG").
export function actaIdFrom(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  const fromLink = text.match(/enfrentamiento\/(?:edit|view)\/(\d{1,10})/);
  if (fromLink) return fromLink[1];
  return /^\d{1,10}$/.test(text) ? text : null;
}
