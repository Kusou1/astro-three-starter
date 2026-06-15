import * as THREE from 'three/webgpu'
import { sceneStore } from '@/store/useSceneStore'

// ── 「3D 渲染器」层（vanilla three，无 R3F）──────────────────────────────────
// 一个 WebGPU canvas，挂在 layout 的 #canvas-root 里、标了 transition:persist，
// 所以它（连同 WebGPU context）跨每次导航存活。这个文件只 init 一次（inited 闸 +
// transition:persist 双保险）；route→scene 通过 zustand vanilla 总线读，导航时
// SceneSwitcher 那套逻辑在这里以 imperative 方式响应。
//
// 真项目里：把下面这个旋转盒换成 per-route <Scene> 模块，crossfade 订阅
// sceneStore.transition 来驱动（同 astro-r3f-starter 的思路，只是这里是 vanilla）。
const ROUTE_COLOR = {
  '/': '#ff7a3d',
  '/about': '#3d9bff',
  '/styleguide': '#9b6dff',
}

let inited = false

export function initCanvas3D() {
  if (inited) return // transition:persist 保住 canvas → 只 init 一次
  inited = true

  const canvas = document.querySelector('#canvas-root canvas')
  if (!canvas) return

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true })

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100)
  camera.position.set(0, 0, 4)

  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const dir = new THREE.DirectionalLight(0xffffff, 2.5)
  dir.position.set(3, 3, 4)
  scene.add(dir)

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.1 }),
  )
  scene.add(mesh)

  // route → 颜色，走跨 island 总线（vanilla subscribe = 同步，无 React 异步延迟）。
  // 盒子的旋转跨导航不重置 = WebGPU context 存活的可视证明；变色 = 总线通的证明。
  const applyRoute = (route) => mesh.material.color.set(ROUTE_COLOR[route] ?? '#888888')
  applyRoute(sceneStore.getState().route)
  sceneStore.subscribe((s, prev) => {
    if (s.route !== prev.route) applyRoute(s.route)
  })

  const resize = () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(innerWidth, innerHeight)
  }
  resize()
  addEventListener('resize', resize)

  let last = performance.now()
  const loop = () => {
    requestAnimationFrame(loop)
    const now = performance.now()
    const dt = (now - last) / 1000
    last = now
    mesh.rotation.x += dt * 0.6
    mesh.rotation.y += dt * 0.9
    renderer.render(scene, camera)
  }

  renderer.init().then(() => loop())
}
