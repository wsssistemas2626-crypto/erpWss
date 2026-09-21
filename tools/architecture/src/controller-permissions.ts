import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

/**
 * Varredura estática dos controllers: toda rota de escrita precisa declarar
 * `@RequirePermission` ou `@Public` (CLAUDE.md §4.5).
 *
 * É análise de fonte, e não de runtime, de propósito: o problema que se quer pegar é o
 * decorator **esquecido**, e uma rota esquecida não aparece em teste nenhum — ela
 * simplesmente responde a quem não devia.
 */

const WRITE_DECORATORS = new Set(['Post', 'Put', 'Patch', 'Delete']);
const AUTHORIZATION_DECORATORS = new Set(['RequirePermission', 'Public']);
const SCANNED_ROOTS = ['apps', 'libs'];

export interface UnprotectedRoute {
  /** Caminho relativo à raiz do workspace. */
  readonly file: string;
  readonly className: string;
  readonly methodName: string;
  /** `Post`, `Put`, `Patch` ou `Delete`. */
  readonly httpMethod: string;
  readonly line: number;
}

export function findUnprotectedWriteRoutes(workspaceRoot: string): readonly UnprotectedRoute[] {
  return controllerFiles(workspaceRoot).flatMap((file) =>
    scanFile(workspaceRoot, file, readFileSync(file, 'utf8')),
  );
}

/** Mesma varredura, sobre um conteúdo em memória: usado pelos testes com fixture. */
export function scanControllerSource(
  fileName: string,
  source: string,
): readonly UnprotectedRoute[] {
  return scanFile('', fileName, source);
}

function controllerFiles(workspaceRoot: string): readonly string[] {
  const found: string[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '__arch_fixtures__') {
        continue;
      }
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (entry.endsWith('.controller.ts') && !entry.endsWith('.spec.ts')) {
        found.push(path);
      }
    }
  };

  for (const root of SCANNED_ROOTS) {
    const path = join(workspaceRoot, root);
    try {
      walk(path);
    } catch {
      // raiz inexistente: nada a varrer
    }
  }

  return found.sort();
}

function scanFile(
  workspaceRoot: string,
  file: string,
  source: string,
): readonly UnprotectedRoute[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.ES2023, true);
  const relativeFile =
    workspaceRoot === '' ? file : relative(workspaceRoot, file).split(sep).join('/');
  const found: UnprotectedRoute[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && hasDecorator(node, 'Controller')) {
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) {
          continue;
        }
        const httpMethod = writeDecoratorOf(member);
        if (httpMethod === undefined) {
          continue;
        }
        if (
          hasAnyDecorator(member, AUTHORIZATION_DECORATORS) ||
          hasAnyDecorator(node, AUTHORIZATION_DECORATORS)
        ) {
          continue;
        }
        found.push({
          file: relativeFile,
          className: node.name?.text ?? '(anônima)',
          methodName: member.name.getText(sourceFile),
          httpMethod,
          line: sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

function decoratorNames(node: ts.Node): readonly string[] {
  const decorators = ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
  return decorators.map((decorator) => {
    const expression = ts.isCallExpression(decorator.expression)
      ? decorator.expression.expression
      : decorator.expression;
    return ts.isIdentifier(expression) ? expression.text : expression.getText();
  });
}

function hasDecorator(node: ts.Node, name: string): boolean {
  return decoratorNames(node).includes(name);
}

function hasAnyDecorator(node: ts.Node, names: ReadonlySet<string>): boolean {
  return decoratorNames(node).some((name) => names.has(name));
}

function writeDecoratorOf(node: ts.MethodDeclaration): string | undefined {
  return decoratorNames(node).find((name) => WRITE_DECORATORS.has(name));
}
