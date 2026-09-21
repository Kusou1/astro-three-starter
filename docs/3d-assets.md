# 3D 资源生产管线

## 使用

1. 原始 GLB / PNG 放 `source-assets/`（不进入 dist）。
2. 编辑 `assets-3d.config.json`，路径分别相对 source-assets 和 public/assets-3d：

```json
{
  "models": [{ "input": "hero.glb", "output": "hero.glb" }],
  "textures": [
    { "input": "base.png", "output": "base.ktx2", "color": "srgb" },
    { "input": "ao.png", "output": "ao.ktx2", "color": "linear" }
  ]
}
```

3. `npm run assets:3d`。贴图需要 Khronos KTX-Software 的 `toktx`（从 [官方 Releases](https://github.com/KhronosGroup/KTX-Software/releases) 安装，或用 TOKTX 环境变量指定二进制；当前 Homebrew 无此包）。空 manifest 不需要该工具。
4. `npm run build` 会同步当前 Three 的解码器；离线压缩不自动重复运行。生产 GLB/KTX2 可提交，解码器及 report 不提交，由 prebuild 生成。
5. 检查 public/assets-3d/report.json 的体积，再用 build + preview 验图。小文件压缩后可能更大，体积降低不等于视觉验收。

## 模型策略

默认只启用 EXT_meshopt_compression，保留输入的 accessor 类型、顶点次序和节点 transform，不调用 quantize / weld / prune。输入已量化则不会恢复 FLOAT。粒子采样应从原始 FLOAT 模型开始。
`reorderVertices: true` 可选择优化顶点顺序，但外部逐顶点数据、顶点 ID 驱动 shader 不应启用。
GLB 自带纹理会保留；不会自动提取、替换为独立 KTX2。Draco 输入需先导出无 Draco 的源 GLB。

## 色彩契约

| color | KTX metadata | 用途 |
|---|---|---|
| srgb | sRGB | 常规 baseColor / emissive，使用材质正常颜色链路 |
| linear | linear，无色度原色 | AO / mask / roughness / normal 等数据 |
| srgb-manual | linear，sRGB 原色 | 仅在 shader 明确调用一次 sRGBTransferEOTF 时使用 |

不要把项目里“手动 EOTF”的特例推广到所有 TSL 材质。默认使用 srgb。srgb-manual 的自动 mip 过滤在编码数值域进行；对高对比细节需要特别验图，优先使用标准 srgb 链路。

## 运行时（两套 starter 共用）

```js
import { createAssetLoaders } from '@/lib/assets3d'
import { withBase } from '@/utils/basePath'

// vanilla: await renderer.init(); R3F: 在 Canvas 内 useThree 取 gl，effect 中创建。
const loaders = createAssetLoaders(renderer)
const model = await loaders.loadModel(withBase('/assets-3d/hero.glb'))
const ao = await loaders.loadTexture(withBase('/assets-3d/ao.ktx2'), { color: 'linear' })
// R3F: <primitive object={model.scene} />；vanilla: scene.add(model.scene)
```

每个持久 renderer 一套 loader；不要每帧创建。GLTFLoader 会处理模型内 KTX2 材质。
独立贴图默认 flipY=false，适配 glTF UV；普通 Plane UV 如需翻转请显式传 flipY。
加载错误会 reject，由调用方选择重试或错误 UI；不静默回退原始资产。
异步加载完成前离开页面时，调用方应丢弃并释放结果，不能把过期模型挂回新页面。
loader.dispose() 只释放转码 worker，模型 geometry/material/texture 由资源所有者释放，不要在跨路由共享时提前销毁。
本模块是 opt-in，不自动加入现有 AssetsProvider 或 Loading gate。

## 2026-09-20 版本与旧 workaround 审计

当前 Astro 7.3.3 / @astrojs/react 6.0.6；锁定 Three r180、Fiber 9.6.1、Drei 10.7.7；npm 最新 Three r186、Fiber 9.7.0、Drei 10.7.8。本次不混入跨版本渲染升级。
- 当前 Three 的 KTX2Loader.detectSupport 原生支持 WebGPURenderer，使用官方 addon，无 three-stdlib 扩展探测补丁。
- glTF Transform 4.5.0 的 meshopt() 仍为 reorder + quantize + compression；不直接用于需保留坐标的资产。
- 标准色彩链路无需统一手动解码；只为显式 EOTF shader 保留 srgb-manual 选项。
- 解码 JS/WASM 从同一 Three 包复制，版本 URL 避免升级后缓存错配。public worker 不受 Vite target 转译；没有目标旧内核需求，不默认抄旧 worker 补丁。
- 保留现有 Canvas/View/tunnel 架构，本次没有改其兼容逻辑。

参考：[Three KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html)、[glTF Transform meshopt 源码](https://github.com/donmccurdy/glTF-Transform/blob/v4.5.0/packages/functions/src/meshopt.ts)、[Khronos KTX artist guide](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md)。

## 验证与交接（2026-09-20）

仓库自带可复现的灰阶 fixture（`node script/create-asset-demo.js` 重建源文件）。默认 manifest 已接入 demo；真实项目替换 manifest，并删除不再需要的 demo 源文件、产物和 `/assets` 验证页。脚本不会擅自删除旧产物，移除 manifest 条目时需同步移走 public 下相应旧文件。

- `npm test`：11 项通过，包括 GLB FLOAT 坐标/顶点次序/transform/morph/animation 往返，及当前 Three r180 Meshopt 解码器读取新编码器产物。
- `npm run build` 通过；源 GLB/PNG 不在 dist，解码 JS/WASM 与安装的 Three 文件逐字节一致。
- `/assets` 是独立技术验收页（不用持久 Canvas 壳）。Chrome WebGPU + `?webgl=1` 的 WebGL2 两个后端均通过，三色块中心像素精确为 128 / 188 / 128，metadata 错配拒绝，无运行时异常。
- 贴图使用 KTX-Software 4.4.2 实际编码，生成完整 mip 链。此小样主要验证正确性，容器头开销导致 GLB 804→1548 B、PNG 263→604 B，不应拿它说明压缩率。
- Safari / iOS / 微信及其不同 GPU transcode target 尚未真机验证；项目接入实际素材后需按目标设备继续验收。
- `linear + srgb primaries` 会被 Three 识别为 LinearSRGBColorSpace；加载入口接受它，再为显式解码模式设 NoColorSpace。不能将它误判为已硬件解码。

后续按项目需要将 createAssetLoaders 接入持久 renderer 的资源所有者及 Loading gate；starter 不默认塞入客户模型，不再引入 three-stdlib KTX2 补丁。Three r186 / Fiber / Drei 升级另作独立渲染回归。

## 2026-09-21：3D 依赖升级

- 当前 Three 0.186.0；R3F starter 为 Fiber 9.7.0 / Drei 10.7.8。React 与 React DOM 限定 `~19.2.7`，实际安装 19.2.8；Fiber 9.7 的 peer 范围是 `>=19 <19.3`，不使用 force/legacy-peer-deps 绕过。
- 资源验证页在 `await renderer.init()` 后调用 `renderer.render()`，移除已弃用的 renderAsync。Basis JS/WASM 随 prebuild 同步为 0.186.0 配对；清理自有 basis 目录中旧 semver 子目录，避免旧 worker 继续进入 dist。
- R3F Canvas 显式配置 `{ enabled: false, type: THREE.PCFShadowMap }`，替代 R3F 的 PCFSoftShadowMap 默认值，同时保持阴影关闭。
- 最新 Drei View 源码仍使用 bottom-up 坐标，保留自写 View；没有照版本号猜测旧问题已解决。
- 两库测试与构建通过；Chrome 中跨 ClientRouter 导航复用同一 Canvas 并持续提交 GPU 帧。资源验收页在 WebGPU/WebGL2 四组均得到 128/188/128 灰阶，错误 metadata 会 reject。
- 临时双 View 测试在两个后端均逐像素对齐 DOM：完整 rect 300×240；滚动 280px 后，第一块裁为 300×140，第二块仍为 300×240。临时测试页面不作为生产路由保留。
- 上游提示仍有两项：Fiber 9.7 内部使用 Three.Clock；SSR 构建加载 Fiber 的 CJS 入口时触发 Three require 弃用提示。未 patch node_modules，也未屏蔽提示；本次运行通过，但后续版本移除 API 前需跟进 Fiber。
- 本次未覆盖 Safari / iOS / 微信真机。shuyun、lifeSciences 未升级。

参考：[Three 迁移指南](https://github.com/mrdoob/three.js/wiki/Migration-Guide)、[Fiber 9.7](https://github.com/pmndrs/react-three-fiber/releases/tag/v9.7.0)、[Drei 10.7.8](https://github.com/pmndrs/drei/releases/tag/v10.7.8)。
