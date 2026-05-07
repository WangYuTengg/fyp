import type { UmlDiagramType } from '../UMLEditor';

export type ValidationSeverity = 'error' | 'warning';

export type ValidationIssue = {
  severity: ValidationSeverity;
  line: number;
  message: string;
};

const STRIP_COMMENT = /(?<!:)'.*$/; // PlantUML single-quote comment, not the colon-prefixed label

/**
 * Lightweight, regex-driven validator for PlantUML text. The goal is to surface
 * the most common authoring mistakes inline before a server round-trip — not to
 * be a full parser. We never block submission; issues are advisory.
 */
export function validatePlantUml(
  text: string,
  diagramType: UmlDiagramType = 'class'
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const trimmed = text.trim();
  if (trimmed.length === 0) return issues;

  const lines = text.split('\n');
  const startIndices: number[] = [];
  const endIndices: number[] = [];
  let braceBalance = 0;
  let braceMismatchLine: number | null = null;
  const declaredAliases = new Set<string>();

  const declarePattern = (() => {
    if (diagramType === 'sequence') {
      return /\b(?:actor|participant|database|control|boundary|entity|collections|queue)\b\s+(?:"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*))/i;
    }
    return /\b(?:abstract\s+class|class|interface|enum)\s+(?:"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*))/i;
  })();

  // Permissive arrow detection — captures the bookended identifiers we expect to be declared.
  const arrowPattern = diagramType === 'sequence'
    ? /^([A-Za-z_][A-Za-z0-9_]*)\s*(?:"[^"]*"\s*)?(?:->|->>|-->)\s*(?:"[^"]*"\s*)?([A-Za-z_][A-Za-z0-9_]*)/
    : /^([A-Za-z_][A-Za-z0-9_]*)\s*(?:"[^"]*"\s*)?(?:-+>|<-+|<\|--|--\|>|<\|\.\.|\.\.\|>|o--|--o|\*--|--\*|\.\.>|<\.\.|--)\s*(?:"[^"]*"\s*)?([A-Za-z_][A-Za-z0-9_]*)/;

  // First pass: find @startuml / @enduml, collect declarations and brace state.
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const stripped = raw.replace(STRIP_COMMENT, '').trim();
    if (stripped.length === 0) continue;

    const lower = stripped.toLowerCase();
    if (lower.startsWith('@startuml')) {
      startIndices.push(i);
      continue;
    }
    if (lower.startsWith('@enduml')) {
      endIndices.push(i);
      continue;
    }
    if (lower.startsWith('note ')) {
      // Notes can contain arbitrary text + braces; skip declaration/brace checks for the line.
      continue;
    }

    const declareMatch = stripped.match(declarePattern);
    if (declareMatch) {
      const alias = declareMatch[2] ?? declareMatch[3];
      if (alias) declaredAliases.add(alias);
    }

    // Brace tracking — only outside string literals (best-effort).
    for (const ch of stripped.replace(/"[^"]*"/g, '')) {
      if (ch === '{') {
        braceBalance += 1;
      } else if (ch === '}') {
        braceBalance -= 1;
        if (braceBalance < 0 && braceMismatchLine === null) {
          braceMismatchLine = i + 1;
        }
      }
    }
  }

  if (startIndices.length === 0) {
    issues.push({
      severity: 'error',
      line: 1,
      message: 'Missing @startuml — every diagram must start with @startuml.',
    });
  }
  if (startIndices.length > 1) {
    issues.push({
      severity: 'warning',
      line: startIndices[1] + 1,
      message: 'Multiple @startuml blocks — the visual builder can only round-trip one diagram.',
    });
  }
  if (endIndices.length === 0) {
    issues.push({
      severity: 'error',
      line: lines.length,
      message: 'Missing @enduml — every diagram must end with @enduml.',
    });
  }
  if (endIndices.length > 1) {
    issues.push({
      severity: 'warning',
      line: endIndices[1] + 1,
      message: 'Multiple @enduml blocks — the visual builder can only round-trip one diagram.',
    });
  }

  if (startIndices.length > 0 && endIndices.length > 0) {
    const firstStart = startIndices[0];
    const firstEnd = endIndices[0];
    if (firstEnd <= firstStart) {
      issues.push({
        severity: 'error',
        line: firstEnd + 1,
        message: '@enduml appears before @startuml.',
      });
    } else {
      const body = lines.slice(firstStart + 1, firstEnd).filter((line) => line.trim().length > 0);
      if (body.length === 0) {
        issues.push({
          severity: 'warning',
          line: firstStart + 1,
          message: 'Diagram body is empty between @startuml and @enduml.',
        });
      }
    }
  }

  if (braceBalance !== 0) {
    issues.push({
      severity: 'error',
      line: braceMismatchLine ?? lines.length,
      message:
        braceBalance > 0
          ? `Unbalanced braces: ${braceBalance} more "{" than "}".`
          : `Unbalanced braces: ${Math.abs(braceBalance)} more "}" than "{".`,
    });
  }

  // Second pass: flag arrow lines whose endpoints don't appear in declarations.
  // We only flag when at least one declaration exists — diagrams that omit
  // explicit declarations rely on PlantUML's inference and should not error.
  if (declaredAliases.size > 0) {
    for (let i = 0; i < lines.length; i += 1) {
      const stripped = lines[i].replace(STRIP_COMMENT, '').trim();
      if (stripped.length === 0) continue;
      if (stripped.startsWith('@')) continue;
      if (declarePattern.test(stripped)) continue;
      const arrowMatch = stripped.match(arrowPattern);
      if (!arrowMatch) continue;
      const [, source, target] = arrowMatch;
      if (source && !declaredAliases.has(source)) {
        issues.push({
          severity: 'warning',
          line: i + 1,
          message: `"${source}" is referenced in a relationship but not declared.`,
        });
      }
      if (target && target !== source && !declaredAliases.has(target)) {
        issues.push({
          severity: 'warning',
          line: i + 1,
          message: `"${target}" is referenced in a relationship but not declared.`,
        });
      }
    }
  }

  return issues;
}
