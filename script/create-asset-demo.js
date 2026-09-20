// Reproducible, project-owned acceptance fixtures; no customer assets.
import { Document, NodeIO } from '@gltf-transform/core'
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'
const directory = 'source-assets/demo'
await mkdir(directory, { recursive: true })
const document = new Document()
const buffer = document.createBuffer()
const attribute = (type, values) => document.createAccessor().setType(type).setArray(values).setBuffer(buffer)
const primitive = document.createPrimitive()
  .setAttribute('POSITION', attribute('VEC3', new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0])))
  .setAttribute('TEXCOORD_0', attribute('VEC2', new Float32Array([0,0, 1,0, 1,1, 0,1])))
  .setIndices(attribute('SCALAR', new Uint16Array([0,1,2, 0,2,3])))
const node = document.createNode('asset-demo').setMesh(document.createMesh().addPrimitive(primitive))
document.createScene().addChild(node)
await new NodeIO().write(`${directory}/plane.glb`, document)
await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } } }).png().toFile(`${directory}/gray.png`)
