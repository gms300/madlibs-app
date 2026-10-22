const modifiers = Object.freeze({
  CapitalizeFirst: value => {
    const characters = Array.from(value);
    if (!characters.length) return value;
    characters[0] = characters[0].toUpperCase();
    return characters.join('');
  }
});
const modifierNamesByLowercase = new Map(Object.keys(modifiers).map(name => [name.toLowerCase(), name]));

export function namesMatch(first, second) {
  return first.toLowerCase() === second.toLowerCase();
}

export function findCaseInsensitiveKey(object, name) {
  return Object.keys(object).find(key => namesMatch(key, name));
}

export function parsePlaceholder(content) {
  const [reference, ...modifierParts] = content.split('|');
  const referenceParts = reference.trim().split('.');
  if (referenceParts.length > 2 || !referenceParts[0] || referenceParts.some(part => !part.trim())) return null;

  return {
    key: referenceParts[0].trim(),
    attribute: referenceParts[1]?.trim(),
    modifierNames: modifierParts.map(part => part.trim())
  };
}

export function isKnownModifier(name) {
  return modifierNamesByLowercase.has(name.toLowerCase());
}

export function applyModifiers(value, modifierNames) {
  if (!modifierNames.every(isKnownModifier)) return null;
  return modifierNames.reduce((result, name) =>
    modifiers[modifierNamesByLowercase.get(name.toLowerCase())](result), value);
}
