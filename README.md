# astro-three-starter

Best-practice scaffold for **content + WebGL experience sites**, **vanilla three.js** flavour:
Astro renders the document shell + SEO, a single **persistent WebGPU canvas** lives in the
layout and survives navigation, GSAP stitches DOM ↔ canvas, and a vanilla Zustand store is
the cross-island bus.

> Sibling of **astro-r3f-starter**. Same persistent-canvas mechanism, but **no React/R3F** —
> the 3D is a plain `<canvas>` driven by a vanilla `three/webgpu` module (`canvas3d.js`).
> Use this base when the project's three code is vanilla (e.g. ports of WaveParticle /
> uunn-official-website), so you don't rewrite it into R3F.

> **v0 是「命脉 spike」+ 骨架二合一。** 验收的命门就是整个 Astro 赌注的关键:
> *WebGPU canvas 跨 ClientRouter 导航,context 不重建吗?* 先在 Chrome **和** Safari 确认这条,
> 再往上搭真东西。

## Versions

Astro 7.3.3; Node 22.12+ (`.nvmrc`: 22.22.2); sharp 0.35.4.

## Run

```bash
nvm use            # Node 22.22.2 (minimum 22.12.0)
npm ci
npm run dev        # http://localhost:4321
```

## ✅ 验收测试（先做这个）

先运行 `npm run build && npm run preview`，打开 preview 地址，分别在 **Chrome** 和 **Safari**:

1. **持久性** — 盯着旋转盒。点 `Home → About → Style Guide`。盒子必须**保持平滑旋转**——不闪、不归零。归零 = WebGPU context 被重建 = 该浏览器持久失败。
2. **总线** — 盒子**按路由变色**(橙/蓝/紫)。证明 layout 的 script 和 canvas 模块共享同一个 store。
3. **GSAP 生命周期** — 标题/段落**每次导航 fade/blur 进来**(`astro:page-load` 在 swap 后的新 DOM 上重跑)。
4. **SEO** — View Source `/about`:有自己的 `<title>` / OG meta,服务端渲染(非客户端注入)。

**若 Safari 丢 context(盒子归零)**:这是 WebGPU-跨-swap 的已知边界。退 **Plan B** —— 把 canvas 移出被 swap 的区域(固定 shell,ClientRouter 永不 swap 它),DOM 不脱离就丢不了 context。见下。

## Architecture（分层）

| 层 | 在哪 | 说明 |
|---|---|---|
| 文档 / SEO / 路由 | `pages/*.astro` + `<ClientRouter/>` | 文件即路由;每路由静态 HTML |
| 3D 渲染器 | `canvas/canvas3d.js` —— 一个 `<canvas transition:persist>` 在 `Base.astro` | **跨导航不重建**;`initCanvas3D()` 只跑一次 |
| 动效 | `lib/transitions.js` 里 GSAP | 连接组织,不是柱子;跨 DOM + canvas |
| 状态总线 | `store/useSceneStore.js`(zustand vanilla) | 隔离的 island/script 互通的唯一通道 |
| 滚动 | `lib/scroll.js`(Lenis) | 全局单例,每 `astro:page-load` 重挂 |
| 数据 | `lib/data.js` | fetch JSON from API;不用 tpl |

## File map

```
src/
├── layouts/Base.astro       # <head> ClientRouter + SEO; 持久 <canvas transition:persist>; <slot/>;
│                            #   <script> 调 initCanvas3D() + initTransitions() + initScroll()(都幂等,只跑一次)
├── pages/                   # index / about / styleguide  (文件 = 路由)
├── components/Nav.astro     # 链接 — ClientRouter 自动拦截
├── canvas/
│   └── canvas3d.js           # vanilla three/webgpu 渲染器 + route→scene + RAF;init 一次(inited 闸)
├── store/useSceneStore.js   # vanilla zustand = 跨 island 总线
├── lib/
│   ├── transitions.js        # ClientRouter 生命周期:page-load intro / before-swap teardown / route 同步
│   ├── scroll.js             # Lenis 单例,每次导航重挂
│   └── data.js               # fetch-from-API 数据缝
└── styles/                  # SCSS + tokens (_variables) + global
```

### vs astro-r3f-starter（差异）

| | astro-r3f-starter | 这里(vanilla) |
|---|---|---|
| 3D 层 | React island `<Canvas3D client:load>`(R3F) | 裸 `<canvas>` + `canvas3d.js` 的 `initCanvas3D()` |
| 依赖 | + react / react-dom / @astrojs/react / @react-three/fiber | 去掉这些 |
| three import | R3F 引 bare `three` + 渲染器引 `three/webgpu` → 需 `dedupe: ['three']` | 只走 `three/webgpu` 一条 → 无 dedupe |
| 场景切换 | `SceneSwitcher.jsx` `useFrame`/`useStore` | `canvas3d.js` 里 `sceneStore.subscribe` + 自己的 RAF |

## Extending

- **新页** → 丢 `pages/foo.astro` 用 `Base`。在 `canvas3d.js` 加它的 3D(或 per-route 场景模块),按 `route` 映射。
- **编排式 outro**(GSAP 导航前)→ 拦 link、跑 outro、再 `navigate(href)`(from `astro:transitions/client`);新页 intro 在 `astro:page-load` 触发。crossfade 订阅 `sceneStore.transition`(imperative `sceneStore.subscribe`)。
- **ScrollTrigger** → `astro:page-load` 建,`teardown()` 里 `ScrollTrigger.getAll().forEach(t => t.kill())`。
- **数据** → 只动 `lib/data.js`。客户项目:塞个 Prismic client。

### Plan B（某浏览器 `transition:persist` 撑不住 WebGPU 时）

把 `#canvas-root` 移到**不在 ClientRouter swap 区**——固定 shell,永不被 swap,只让 ClientRouter swap `<main>`。canvas DOM 不脱离 → context 丢不了。导航接线更手动,但更稳。

## Conventions

- **Vanilla JS,无 TS strict**。`.astro` frontmatter 那点 TS-ish 躲不掉(只是页面壳)。
- SCSS + tokens in `_variables.scss`。单 canvas。Zustand vanilla 当总线。
- 决策日志在 `~/.claude/CLAUDE.md` → 「前端栈默认:Astro 优先」。


## Page lifecycle and loading

Page-owned animations, ScrollTriggers, observers, subscriptions and async waits
must register their cleanup. Persistent Canvas and Loading animations manage
their own lifetime and are not cleared by navigation.

```js
import gsap from 'gsap'
import { createPageScope } from '@/lib/pageScope'

const scope = createPageScope()
const context = gsap.context(() => {
  // Create this page's tweens and ScrollTriggers here.
})
scope.add(() => context.revert())
// Also register observers, RAF cancellation and subscriptions with scope.add().
// For asynchronous callbacks, check scope.signal.aborted before creating work.
// React effects return scope.dispose; Astro before-swap also disposes it once.
```

Both starters use a vanilla preloader store with explicit phases:
`disabled →` immediate entry, or `loading → revealing → ready` when enabled.
Set `features.preloader` in `src/config/features.js` before starting the app;
progress 0 never means disabled. The default is false.

Enabling loading requires an asset loader and a persistent overlay: the loader
calls `preloaderStore.getState().setPreloaded(true)` after its assets settle;
the overlay calls `setPreloadedAnimated(true)` after its exit animation. Merely
turning on the feature without those producers intentionally leaves intros waiting.
The R3F starter supplies AssetsProvider and Preloader; the vanilla starter supplies
the same store/wait contract for a project-specific loader and overlay.

```js
import { waitForPreloaded } from '@/utils/waitForPreloaded'

scope.add(waitForPreloaded(() => {
  // Create the current page's intro and register its cleanup.
}, { signal: scope.signal }))
```

Completion is stored, so late hydration and return navigation read the current
state. Waits cancel on page exit. Progress is monotonic; loading is one initial
session, not automatically reset for every navigation.

`src/lib/reveal.js` supplies the shared DOM reveal engine. Desktop uses blur;
<=812px uses opacity without blur or translation; reduced motion shows content
immediately. Completion removes filter/will-change, and breakpoint changes are
handled by GSAP matchMedia. `[data-reveal]` uses this engine for page intros;
R3F SplitText/Reveal delegate their automatic animations to it. With `intro=true`,
the caller owns playback and final inline-style cleanup.

Run `npm test` for ready-state and page-cleanup regressions, followed by
`npm run build` and browser checks on the preview server.

## Video playback

Open `/video` for a self-contained example (generated test footage: desktop 4s,
mobile 6s). `src/lib/video.js` is shared between both starters:

- `selectVideoSource(video, { desktop, mobile, poster, mobilePoster })` selects
  at the 812px breakpoint before playback. It does not restart on resize; call
  again before replay. Pass imported URLs or `withBase()` public paths.
- `playVideoOnce(video, { signal, onStarted, cues })` requests muted inline
  playback immediately. `onStarted` waits for the media clock to advance.
  `cues: [{ time: 2, callback }]` fires once per run from media time.
- The result is `{ reason, currentTime }`: `ended`, `blocked`, `error`,
  `startup-timeout`, `timeout`, or `aborted`. Only `ended` means completion.
  Startup defaults to 10s; after real playback starts the deadline uses the
  remaining duration / playbackRate plus 1.5s. A stalled video fails instead
  of unlocking an intro as though it had played.
- Own each video with one AbortController. Abort on navigation or before replay;
  cancellation pauses video and removes listeners, timers and frame callbacks.
  Set `currentTime = 0` before replay. `loop` is disabled by the helper.
- Poster remains available before playback. The demo offers a replay button on
  failure and does not autoplay with reduced motion. WeixinJSBridgeReady retries
  a pending attempt; autoplay permission still requires real-device validation.

This is an optional page module, not a global Loading gate or a dual-buffer video
transition system. GLB/video readiness is not automatically added to AssetsProvider.
Frame callbacks use the [browser video-frame API](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback), with a media-clock polling fallback.
