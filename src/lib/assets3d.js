import { NoColorSpace, LinearSRGBColorSpace, SRGBColorSpace } from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import decoder from '@/config/assetDecoder.json'
import { withBase } from '@/utils/basePath'

// One loader set per persistent renderer. Call after renderer.init(), outside render loops.
export function createAssetLoaders(renderer, { manager, transcoderPath } = {}) {
  const ktx2 = new KTX2Loader(manager)
    .setTranscoderPath(transcoderPath ?? withBase(`/assets-3d/basis/${decoder.version}/`))
    .detectSupport(renderer)
  const gltf = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2)
  return {
    gltf,
    ktx2,
    loadModel: (path) => gltf.loadAsync(path),
    async loadTexture(path, { color = 'srgb', flipY = false } = {}) {
      if (!['srgb', 'linear', 'srgb-manual'].includes(color)) throw new Error(`Invalid texture color: ${color}`)
      const texture = await ktx2.loadAsync(path)
      // Metadata determines GPU sRGB decoding. Changing colorSpace cannot undo it.
      if (color !== 'srgb' && ![NoColorSpace, LinearSRGBColorSpace].includes(texture.colorSpace)) {
        texture.dispose()
        throw new Error(`Linear KTX2 metadata required for ${color}: ${path}`)
      }
      if (color === 'srgb' && texture.colorSpace !== SRGBColorSpace) {
        texture.dispose()
        throw new Error(`sRGB KTX2 metadata required: ${path}`)
      }
      if (color !== 'srgb') texture.colorSpace = NoColorSpace
      texture.flipY = flipY
      return texture
    },
    // Dispose workers only after pending loads finish. Loaded models/textures are caller-owned.
    dispose: () => ktx2.dispose(),
  }
}
