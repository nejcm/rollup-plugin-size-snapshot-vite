import bytes from 'bytes';
import chalk from 'chalk';
import gzipSize from 'gzip-size';
import { join } from 'path';
import { minify } from 'terser';
import * as snapshot from './snapshot';
import { treeshakeWithRollup } from './treeshakeWithRollup';

type Options = {
  minify?: boolean;
  snapshot?: string;
  snapshotPath?: string;
  matchSnapshot?: boolean;
  threshold?: number;
  printInfo?: boolean;
};

type OutputOptions = {
  format: string;
  file: string;
};

type Sizes = {
  bundled: number;
  minified: number;
  gzipped: number;
  treeshaked?: Record<string, unknown>;
};

type Plugin = {
  name: string;
  renderChunk: (
    code: string,
    chunk: any,
    options: OutputOptions,
  ) => null | Promise<null>;
};

const validateOptions = (options: any) => {
  const optionsKeys: (keyof Options)[] = [
    'snapshotPath',
    'matchSnapshot',
    'threshold',
    'printInfo',
  ];

  const invalidKeys = Object.keys(options).filter(
    (d: any) => !optionsKeys.includes(d),
  );

  const wrap = (d: string) => `"${d}"`;

  if (1 === invalidKeys.length) {
    throw Error(`Option ${wrap(invalidKeys[0])} is invalid`);
  }

  if (1 < invalidKeys.length) {
    throw Error(`Options ${invalidKeys.map(wrap).join(', ')} are invalid`);
  }
};

const bytesConfig = { thousandsSeparator: ',', unitSeparator: ' ', unit: 'B' };

const formatSize = (d: string | number) =>
  chalk.bold(bytes.format(d, bytesConfig));

export const sizeSnapshot = (options: Options = {}): Plugin => {
  validateOptions(options);

  const snapshotPath =
    options.snapshotPath || join(process.cwd(), '.size-snapshot.json');
  const shouldMatchSnapshot = options.matchSnapshot === true;
  const shouldPrintInfo = options.printInfo !== false;
  const threshold = options.threshold == null ? 0 : options.threshold;

  return {
    name: 'size-snapshot',

    async renderChunk(rawSource, chunk, outputOptions) {
      // remove windows specific newline character
      const source = rawSource.replace(/\r/g, '');
      const format = outputOptions.format;
      const shouldTreeshake = format === 'es' || format === 'esm';

      const outputName = chunk.fileName;

      const minified = (await minify(source)).code || '';
      const treeshakeSize = (code: string) =>
        Promise.all([treeshakeWithRollup(code)]);

      return Promise.all([
        gzipSize(minified),
        shouldTreeshake
          ? treeshakeSize(source)
          : [{ code: 0, import_statements: 0 }, { code: 0 }],
      ]).then(([gzippedSize, [rollupSize]]) => {
        const sizes: Sizes = {
          bundled: source.length,
          minified: minified.length,
          gzipped: gzippedSize,
        };

        const prettyFormat = format === 'es' ? 'esm' : format;
        const prettyBundled = formatSize(sizes.bundled);
        const prettyMinified = formatSize(sizes.minified);
        const prettyGzipped = formatSize(sizes.gzipped);
        let infoString =
          '\n' +
          `Computed sizes of "${outputName}" with "${prettyFormat}" format\n` +
          `  bundler parsing size: ${prettyBundled}\n` +
          `  browser parsing size (minified with terser): ${prettyMinified}\n` +
          `  download size (minified and gzipped): ${prettyGzipped}\n`;

        const formatMsg = (msg: string, size: string | number) =>
          `  ${msg}: ${formatSize(size)}\n`;

        if (shouldTreeshake) {
          sizes.treeshaked = rollupSize;

          infoString += formatMsg(
            'treeshaked with rollup with production NODE_ENV and minified',
            rollupSize.code,
          );
          infoString += formatMsg(
            '  import statements size of it',
            rollupSize.import_statements,
          );
        }

        const snapshotParams = {
          snapshotPath,
          name: outputName,
          data: sizes,
          threshold,
        };
        if (shouldMatchSnapshot) {
          snapshot.match(snapshotParams);
        } else {
          if (shouldPrintInfo) {
            console.info(infoString);
          }
          snapshot.write(snapshotParams);
        }

        return null;
      });
    },
  };
};
