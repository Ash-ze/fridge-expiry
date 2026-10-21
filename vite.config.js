import { defineConfig } from 'vite';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

// 构建时生成 sw.js：把打包产物和 public 目录下的文件写入预缓存清单。
function serviceWorkerPlugin() {
  return {
    name: 'fridge-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const publicDir = 'public';
      const walk = (dir) =>
        readdirSync(dir).flatMap((f) => {
          const p = join(dir, f);
          return statSync(p).isDirectory() ? walk(p) : [relative(publicDir, p).split('\\').join('/')];
        });
      const files = ['./', 'index.html', ...Object.keys(bundle), ...walk(publicDir)]
        .filter((f) => !f.endsWith('.map') && f !== 'sw.js');
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 10);
      const source = readFileSync('src/sw-template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(files.map((f) => (f.startsWith('./') ? f : './' + f))));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorkerPlugin()],
  test: {
    include: ['test/**/*.test.js'],
  },
});
