import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'

const src = (p) => fileURLToPath(new URL(p, import.meta.url))

// Astro 5 + vanilla three (WebGPU/TSL)，无 React/R3F。
// 3D 全部跑在客户端：layout 里一个 transition:persist 的 <canvas>，由 src/canvas/canvas3d.js
// 用 vanilla three 初始化一次、跨导航不重建。Astro 只负责文档壳 + 每路由 SEO。
// 对比 astro-r3f-starter：少了 react() 集成和 three 的 dedupe（没有 R3F 引 bare `three` 与
// `three/webgpu` 双 class 的问题，这里只走 `three/webgpu` 一条 import）。
export default defineConfig({
  vite: {
    resolve: {
      alias: { '@': src('./src') },
    },
    css: {
      preprocessorOptions: {
        scss: {
          // 把设计令牌（_utils rem()/断点/flex + _variables 颜色/ease）自动注入每个 .scss
          // （global.scss、组件 <style lang="scss">），组件里直接用 $var / rem() / @include，无需 @use。
          // 注意：additionalData 只到达 Vite 处理的顶层样式（组件 <style>、JS-import 的 global.scss），
          // 不到达被 @use 拉进来的 partial（_variables/_utils 自身）——它们各自 @use 所需。
          additionalData: [
            `@use "${src('./src/styles/_utils.scss')}" as *;`,
            `@use "${src('./src/styles/_variables.scss')}" as *;`,
          ].join('\n'),
        },
      },
    },
  },
})
