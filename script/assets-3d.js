import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { reorder } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'
import { mkdir, readFile, writeFile, copyFile, stat, readdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve, relative, isAbsolute } from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
export const threeRoot = resolve(dirname(require.resolve('three')), '..')
export const threeVersion = JSON.parse(await readFile(resolve(threeRoot, 'package.json'))).version

export function within(root, file) {
  const path = resolve(root, file)
  const rel = relative(root, path)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Path outside asset directory: ${file}`)
  return path
}

export async function compressModel(input, output, { reorderVertices = false } = {}) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
  })
  const document = await io.read(input)
  // Reordering changes vertex IDs: opt in only when no external per-vertex data depends on them.
  if (reorderVertices) await document.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }))
  document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
    method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
  })
  // QUANTIZE here selects lossless buffer encoding; no quantize() transform is run.
  await mkdir(dirname(output), { recursive: true })
  await io.write(output, document)
  return { inputBytes: (await stat(input)).size, outputBytes: (await stat(output)).size }
}

export function textureArgs(input, output, color) {
  if (!['srgb', 'linear', 'srgb-manual'].includes(color)) throw new Error(`Explicit texture color required: ${color}`)
  // srgb-manual is encoded sRGB data with linear metadata, for explicit shader EOTF only.
  return ['--t2', '--encode', 'uastc', '--zcmp', '18', '--genmipmap',
    '--assign_oetf', color === 'srgb' ? 'srgb' : 'linear',
    '--assign_primaries', color === 'linear' ? 'none' : 'srgb', output, input]
}

export async function buildAssets(configPath = 'assets-3d.config.json') {
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const source = resolve('source-assets')
  const output = resolve('public/assets-3d')
  const entries = [...(config.models ?? []), ...(config.textures ?? [])]
  const outputs = new Set()
  // Validate the complete manifest before writing anything.
  for (const entry of entries) {
    within(source, entry.input)
    within(output, entry.output)
    if (outputs.has(entry.output)) throw new Error(`Duplicate output: ${entry.output}`)
    outputs.add(entry.output)
  }
  for (const entry of config.models ?? []) {
    if (!entry.input.endsWith('.glb') || !entry.output.endsWith('.glb')) throw new Error('Models must be GLB')
  }
  for (const entry of config.textures ?? []) {
    if (!entry.output.endsWith('.ktx2')) throw new Error('Textures must output KTX2')
    textureArgs('', '', entry.color)
  }
  const toktx = process.env.TOKTX || 'toktx'
  if (config.textures?.length) execFileSync(toktx, ['--version'], { stdio: 'inherit' })
  const report = { threeVersion, models: [], textures: [] }
  for (const entry of config.models ?? []) {
    const sizes = await compressModel(within(source, entry.input), within(output, entry.output), entry)
    report.models.push({ ...entry, ...sizes })
  }
  for (const entry of config.textures ?? []) {
    const input = within(source, entry.input)
    const target = within(output, entry.output)
    await mkdir(dirname(target), { recursive: true })
    execFileSync(toktx, textureArgs(input, target, entry.color), { stdio: 'inherit' })
    report.textures.push({ ...entry, inputBytes: (await stat(input)).size, outputBytes: (await stat(target)).size })
  }
  await syncDecoders()
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
  return report
}

export async function syncDecoders() {
  // Matching JS + WASM, versioned URLs: never reuse a stale decoder after a Three upgrade.
  const decoderPath = resolve(`public/assets-3d/basis/${threeVersion}`)
  await mkdir(decoderPath, { recursive: true })
  for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
    await copyFile(resolve(threeRoot, 'examples/jsm/libs/basis', file), resolve(decoderPath, file))
  }
  await copyFile(resolve(threeRoot, 'LICENSE'), resolve(decoderPath, 'THREE-LICENSE.txt'))
  await writeFile('src/config/assetDecoder.json', JSON.stringify({ version: threeVersion }) + '\n')
  // This directory is generated by us. Keep obsolete decoder pairs out of dist.
  const basisRoot = dirname(decoderPath)
  for (const entry of await readdir(basisRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && /^\d+\.\d+\.\d+$/.test(entry.name) && entry.name !== threeVersion) {
      await rm(resolve(basisRoot, entry.name), { recursive: true })
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildAssets(process.argv[2]).catch((error) => { console.error(error.message); process.exitCode = 1 })
}
