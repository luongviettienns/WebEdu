import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_TYPES_PATH = path.resolve(CURRENT_DIR, 'assignments.types.ts');
const FRONTEND_API_PATH = path.resolve(
  CURRENT_DIR,
  '../../../../frontend/src/features/assignments/api/assignments.api.ts',
);

const EXPECTED_INTERFACES = [
  'OptionAnswerPayload',
  'TextAnswerPayload',
  'OrderingAnswerPayload',
  'ClassAssignmentStatsDto',
  'ClassAssignmentSummaryDto',
  'StudentAssignmentListItemDto',
  'SanitizedOptionDto',
  'SanitizedQuestionDto',
  'StudentSubmissionAnswerDto',
  'StudentExamSessionDto',
  'SupersededAttemptDto',
  'TeacherTrackerStudentRowDto',
  'TeacherAssignmentSubmissionsDto',
] as const;

const EXPECTED_TYPE_ALIASES = [
  'AssignmentDisplayStatus',
  'EmptyAnswerPayload',
  'StudentAnswerPayload',
] as const;

interface NormalizedMember {
  name: string;
  optional: boolean;
  type: string;
}

interface ParsedContracts {
  interfaces: Map<string, NormalizedMember[]>;
  typeAliases: Map<string, string>;
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  return Boolean(ts.getModifiers(node)?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword));
}

function normalizePropertyName(name: ts.PropertyName, sourceFile: ts.SourceFile): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText(sourceFile).replace(/\s+/g, ' ').trim();
}

function serializeTypeNode(node: ts.TypeNode, sourceFile: ts.SourceFile): string {
  if (ts.isUnionTypeNode(node)) {
    return node.types.map((member) => serializeTypeNode(member, sourceFile)).join(' | ');
  }
  if (ts.isIntersectionTypeNode(node)) {
    return node.types.map((member) => serializeTypeNode(member, sourceFile)).join(' & ');
  }
  if (ts.isParenthesizedTypeNode(node)) {
    return `(${serializeTypeNode(node.type, sourceFile)})`;
  }
  if (ts.isArrayTypeNode(node)) {
    return `${serializeTypeNode(node.elementType, sourceFile)}[]`;
  }
  if (ts.isTupleTypeNode(node)) {
    return `[${node.elements.map((el) => serializeTypeNode(el, sourceFile)).join(', ')}]`;
  }
  if (ts.isTypeLiteralNode(node)) {
    const members = node.members.map((member) => serializeTypeElement(member, sourceFile));
    return `{ ${members.join('; ')} }`;
  }
  if (ts.isTypeReferenceNode(node)) {
    const typeName = node.typeName.getText(sourceFile).replace(/\s+/g, ' ').trim();
    if (!node.typeArguments || node.typeArguments.length === 0) {
      return typeName;
    }
    const args = node.typeArguments.map((arg) => serializeTypeNode(arg, sourceFile)).join(', ');
    return `${typeName}<${args}>`;
  }
  const printer = ts.createPrinter({ removeComments: true });
  return printer
    .printNode(ts.EmitHint.Unspecified, node, sourceFile)
    .replace(/\s+/g, ' ')
    .trim();
}

function serializeTypeElement(member: ts.TypeElement, sourceFile: ts.SourceFile): string {
  if (ts.isPropertySignature(member)) {
    const propName = normalizePropertyName(member.name, sourceFile);
    const optional = member.questionToken ? '?' : '';
    const propType = member.type ? serializeTypeNode(member.type, sourceFile) : 'unknown';
    return `${propName}${optional}: ${propType}`;
  }
  const printer = ts.createPrinter({ removeComments: true });
  return printer
    .printNode(ts.EmitHint.Unspecified, member, sourceFile)
    .replace(/\s+/g, ' ')
    .trim();
}

function extractContracts(filePath: string): ParsedContracts {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const interfaces = new Map<string, NormalizedMember[]>();
  const typeAliases = new Map<string, string>();

  for (const stmt of sourceFile.statements) {
    if (!hasExportModifier(stmt)) continue;

    if (ts.isInterfaceDeclaration(stmt)) {
      const members: NormalizedMember[] = stmt.members.map((member) => {
        if (!ts.isPropertySignature(member)) {
          throw new Error(`Unsupported interface member in ${stmt.name.text} (${filePath})`);
        }
        return {
          name: normalizePropertyName(member.name, sourceFile),
          optional: Boolean(member.questionToken),
          type: member.type ? serializeTypeNode(member.type, sourceFile) : 'unknown',
        };
      });
      interfaces.set(stmt.name.text, members);
    } else if (ts.isTypeAliasDeclaration(stmt)) {
      typeAliases.set(stmt.name.text, serializeTypeNode(stmt.type, sourceFile));
    }
  }

  return { interfaces, typeAliases };
}

describe('Assignments Backend-Frontend DTO Contract Parity', () => {
  const backendContracts = extractContracts(BACKEND_TYPES_PATH);
  const frontendContracts = extractContracts(FRONTEND_API_PATH);

  it('covers every exported interface and type alias in assignments.types.ts without omissions', () => {
    expect(Array.from(backendContracts.interfaces.keys()).sort()).toEqual(
      [...EXPECTED_INTERFACES].sort(),
    );
    expect(Array.from(backendContracts.typeAliases.keys()).sort()).toEqual(
      [...EXPECTED_TYPE_ALIASES].sort(),
    );
  });

  it.each(EXPECTED_INTERFACES)(
    'keeps exported interface %s identical in field order, optionality, and types',
    (interfaceName) => {
      const backendMembers = backendContracts.interfaces.get(interfaceName);
      const frontendMembers = frontendContracts.interfaces.get(interfaceName);

      expect(backendMembers, `Missing ${interfaceName} in backend types`).toBeDefined();
      expect(frontendMembers, `Missing ${interfaceName} in frontend api`).toBeDefined();
      expect(frontendMembers).toEqual(backendMembers);
    },
  );

  it.each(EXPECTED_TYPE_ALIASES)(
    'keeps exported type alias %s identical between backend and frontend',
    (aliasName) => {
      const backendType = backendContracts.typeAliases.get(aliasName);
      const frontendType = frontendContracts.typeAliases.get(aliasName);

      expect(backendType, `Missing ${aliasName} in backend types`).toBeDefined();
      expect(frontendType, `Missing ${aliasName} in frontend api`).toBeDefined();
      expect(frontendType).toBe(backendType);
    },
  );
});
