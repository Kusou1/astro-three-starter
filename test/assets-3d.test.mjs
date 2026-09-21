import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, mkdir, writeFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder as RuntimeDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { compressModel, textureArgs, within, threeRoot, threeVersion } from '../script/assets-3d.js'

test('Meshopt round trip preserves FLOAT positions, vertex order, transforms, morph and animation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'starter-assets-'))
  try {
    const doc = new Document()
    const buffer = doc.createBuffer()
    const accessor = (name, type, array) => doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer)
    const positions = new Float32Array([-23.125, 1.25, 0, 17.75, 2.5, 0, 0, 31.125, 1])
    const pos = accessor('positions', 'VEC3', positions)
    const morph = accessor('morph', 'VEC3', new Float32Array([0, .5, 0, 0, 1, 0, 0, 2, 0]))
    const primitive = doc.createPrimitive().setAttribute('POSITION', pos)
      .setIndices(accessor('indices', 'SCALAR', new Uint16Array([0, 1, 2])))
      .addTarget(doc.createPrimitiveTarget().setAttribute('POSITION', morph))
    const mesh = doc.createMesh().addPrimitive(primitive).setWeights([.25])
    const node = doc.createNode('sample').setMesh(mesh).setTranslation([4, 5, 6]).setScale([2, 3, 4])
    doc.createScene().addChild(node)
    const sampler = doc.createAnimationSampler().setInput(accessor('time', 'SCALAR', new Float32Array([0, 1])))
      .setOutput(accessor('translation', 'VEC3', new Float32Array([4, 5, 6, 7, 8, 9])))
    doc.createAnimation().addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('translation').setSampler(sampler))
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
    const input = join(dir, 'raw.glb'), output = join(dir, 'compressed.glb')
    await io.write(input, doc)
    await compressModel(input, output)
    const decoded = await io.read(output)
    const decodedNode = decoded.getRoot().listNodes()[0]
    assert.deepEqual(decodedNode.getTranslation(), [4, 5, 6])
    assert.deepEqual(decodedNode.getScale(), [2, 3, 4])
    const decodedPrimitive = decodedNode.getMesh().listPrimitives()[0]
    assert.deepEqual(decodedPrimitive.getAttribute('POSITION').getArray(), positions)
    assert.deepEqual(decodedPrimitive.listTargets()[0].getAttribute('POSITION').getArray(), morph.getArray())
    assert.equal(decodedPrimitive.getAttribute('POSITION').getComponentType(), 5126)
    assert.deepEqual(decoded.getRoot().listAnimations()[0].listSamplers()[0].getOutput().getArray(), sampler.getOutput().getArray())
    // Decode with the installed Three browser decoder too: newer encoder output must remain compatible.
    const bytes = await readFile(output)
    const gltf = await new GLTFLoader().setMeshoptDecoder(RuntimeDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    let runtimeMesh
    gltf.scene.traverse((object) => { if (object.isMesh) runtimeMesh = object })
    assert.equal(runtimeMesh.geometry.attributes.position.count, 3)
    const xyz = runtimeMesh.geometry.attributes.position
    assert.deepEqual(Array.from({ length: 3 }, (_, i) => [xyz.getX(i), xyz.getY(i), xyz.getZ(i)]).flat(), [...positions])
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('texture colors are explicit and paths stay in production directories', () => {
  assert.throws(() => textureArgs('in', 'out', undefined))
  assert.equal(textureArgs('in', 'out', 'srgb')[7], 'srgb')
  assert.equal(textureArgs('in', 'out', 'srgb-manual')[7], 'linear')
  assert.throws(() => within('/project/source-assets', '../public/raw.glb'))
})


test('decoder sync publishes a matching pair and removes obsolete generated versions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'starter-decoders-'))
  try {
    const basis = join(dir, 'public/assets-3d/basis')
    await mkdir(join(basis, '0.1.0'), { recursive: true })
    await writeFile(join(basis, '0.1.0/stale.js'), 'stale')
    await writeFile(join(basis, 'README.md'), 'keep')
    await mkdir(join(dir, 'src/config'), { recursive: true })
    execFileSync(process.execPath, [fileURLToPath(new URL('../script/sync-decoders.js', import.meta.url))], { cwd: dir })
    assert.deepEqual((await readdir(basis)).sort(), [threeVersion, 'README.md'].sort())
    for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
      assert.deepEqual(await readFile(join(basis, threeVersion, file)), await readFile(join(threeRoot, 'examples/jsm/libs/basis', file)))
    }
    assert.equal(JSON.parse(await readFile(join(dir, 'src/config/assetDecoder.json'))).version, threeVersion)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
