import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'

// Astro 5 + vanilla three (WebGPU/TSL)，无 React/R3F。
// 3D 全部跑在客户端：layout 里一个 transition:persist 的 <canvas>，由 src/canvas/canvas3d.js
// 用 vanilla three 初始化一次、跨导航不重建。Astro 只负责文档壳 + 每路由 SEO。
// 对比 astro-r3f-starter：少了 react() 集成和 three 的 dedupe（没有 R3F 引 bare `three` 与
// `three/webgpu` 双 class 的问题，这里只走 `three/webgpu` 一条 import）。
export default defineConfig({
  vite: {
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  },
})
