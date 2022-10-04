# rollup-plugin-size-snapshot

<img src="example2.png" />

This plugin provides details about

- actual bundle size (bundler parsing size)
- minified bundle size (browser parsing size)
- gzipped bundle size (download size)

All of these sizes are important criteria when choosing a library, and they will be stored in the `.size-snapshot.json` file.

## Usage

Inside `vite.config`:

```js
import { sizeSnapshot } from '@nejcm/rollup-plugin-size-snapshot-vite';

export default defineConfig({
  build: {
    rollupOptions: {
      plugins: [sizeSnapshot()],
    },
  },
});
```

> Note: If your config file is as `.ts` file than casting to any might be required. E.g.: `sizeSnapshot() as any`

# License

MIT &copy; [Bogdan Chadkin](mailto:trysound@yandex.ru)
