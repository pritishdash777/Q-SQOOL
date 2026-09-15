// Use the project's existing TypeScript compiler with Node's built-in test runner.
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const url = new URL(specifier, context.parentURL);
      if (existsSync(new URL(`${url.href}.ts`))) return { url: `${url.href}.ts`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts')) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
    if (url.endsWith('/learning-catalog.json')) return {
      format: 'module', shortCircuit: true, source: `export default ${readFileSync(new URL(url), 'utf8')}`,
    };
    return nextLoad(url, context);
  },
});
