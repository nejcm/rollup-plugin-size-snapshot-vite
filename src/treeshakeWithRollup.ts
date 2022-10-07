import replace from '@rollup/plugin-replace';
import { Options, parse } from 'acorn';
import { rollup } from 'rollup';
import { minify } from 'terser';

type Output = {
  code: number;
  import_statements: number;
};

const inputName = '__size_snapshot_input__.js';
const bundleName = '__size_snapshot_bundle__.js';

const isReservedId = (id: string) =>
  id.includes(inputName) || id.includes(bundleName);

const resolvePlugin = ({ code }) => ({
  name: 'resolve-plugin',
  resolveId(importee: string) {
    if (isReservedId(importee)) return importee;
    return null;
  },

  load(id: string) {
    if (id.includes(inputName)) {
      return `import {} from "/${bundleName}";`;
    }
    if (id.includes(bundleName)) {
      return code;
    }
    return null;
  },
});

export const treeshakeWithRollup = (
  code: string,
  parseOptions?: Options,
): Promise<Output> => {
  const config = {
    name: 'rollup-plugin-size-snapshot-vite',
    input: `/${inputName}`,
    onwarn() {},
    external: (id: string) => isReservedId(id) === false,
    plugins: [
      resolvePlugin({ code }),
      replace({ 'process.env.NODE_ENV': JSON.stringify('production') }),
    ],
  };

  return rollup(config)
    .then((bundle) => bundle.generate({ format: 'es' }))
    .then(({ output = [] }) =>
      minify(
        (output.find((chunkOrAsset: any) => chunkOrAsset?.code) as any)?.code,
        {
          toplevel: true,
        },
      ),
    )
    .then((result): Output => {
      const { code = '' } = result;
      const ast = parse(code, {
        sourceType: 'module',
        ecmaVersion: 11,
        ...parseOptions,
      }) as any;
      const import_statements = ast.body
        // collect all toplevel import statements
        .filter((node) => node.type === 'ImportDeclaration')
        // endpos is the next character after node -> substract 1
        .map((node) => node.end - node.start)
        .reduce((acc, size) => acc + size, 0);

      return {
        code: code.length,
        import_statements,
      };
    });
};
