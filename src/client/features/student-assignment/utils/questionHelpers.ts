export function getPrompt(content: unknown): string {
  if (typeof content !== 'object' || content === null) return '';
  const record = content as Record<string, unknown>;
  return typeof record.prompt === 'string' ? record.prompt : '';
}

export function getMcqOptions(content: unknown): Array<{ id: string; text: string }> {
  if (typeof content !== 'object' || content === null) return [];
  const record = content as Record<string, unknown>;
  const options = Array.isArray(record.options) ? record.options : [];
  return options
    .map((option) => ({
      id: typeof option?.id === 'string' ? option.id : '',
      text: typeof option?.text === 'string' ? option.text : '',
    }))
    .filter((option) => option.id && option.text);
}

export function getMcqAllowMultiple(content: unknown): boolean {
  if (typeof content !== 'object' || content === null) return false;
  const record = content as Record<string, unknown>;
  return record.allowMultiple === true;
}

export function getUmlSubtype(content: unknown): 'class' | 'sequence' {
  if (typeof content !== 'object' || content === null) return 'class';
  const record = content as Record<string, unknown>;
  return record.umlSubtype === 'sequence' ? 'sequence' : 'class';
}
