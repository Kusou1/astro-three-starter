// Asset compression — run on demand: `npm run compress [dir]` (default src/assets).
//
// Three asset classes, three policies:
//   src/assets/texture/  → .webp q90 (three.js GPU textures, quality-first)
//   src/assets/image/    → .webp q80, max edge 2560 (DOM <img>)
//   src/assets/video/    → VP9 .webm, 720p desktop + 540p mobile (needs ffmpeg)
//
// Outputs sit next to the source. Originals are left untouched — re-runnable.
// Requires: `sharp` + `glob` (npm), and `ffmpeg` on PATH for the video step.
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'node:child_process'
import { glob } from 'glob'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const baseDir = path.resolve(__dirname, '..', process.argv[2] ?? 'src/assets')

/**
 * Textures — three.js GPU textures, quality-first (quality 90).
 *   <baseDir>/texture/**\/*.{png,jpg,jpeg} → 同目录 .webp
 */
{
    const files = await glob(`${baseDir}/texture/**/*.{png,jpg,jpeg}`)
    console.log(`\n=== Textures: ${files.length} file(s) ===`)
    for (const inputFile of files) {
        const outputFile = inputFile.replace(/\.(png|jpe?g)$/i, '.webp')
        await sharp(inputFile).webp({ quality: 90 }).toFile(outputFile)
        console.log(`✓ ${path.relative(baseDir, outputFile)}`)
    }
}

/**
 * Images — DOM <img> 用（quality 80）。
 *
 * 限制最大边长：webp 文件再小，<img> 解码进内存的位图 = 宽×高×4 字节，
 * 跟磁盘大小无关。不限尺寸的大图滚动到时要解码+上传 GPU 纹理 → 卡顿。
 */
const IMAGE_MAX_EDGE = 2560
{
    const files = await glob(`${baseDir}/image/**/*.{png,jpg,jpeg}`)
    console.log(`\n=== Images: ${files.length} file(s) ===`)
    for (const inputFile of files) {
        const outputFile = inputFile.replace(/\.(png|jpe?g)$/i, '.webp')
        const { width = 0, height = 0 } = await sharp(inputFile).metadata()
        const resized = Math.max(width, height) > IMAGE_MAX_EDGE
        await sharp(inputFile)
            .resize({
                width: IMAGE_MAX_EDGE,
                height: IMAGE_MAX_EDGE,
                fit: 'inside', // 等比缩放，长边贴 IMAGE_MAX_EDGE
                withoutEnlargement: true // 小图不放大
            })
            .webp({ quality: 80 })
            .toFile(outputFile)
        const tag = resized
            ? `${width}×${height} → ≤${IMAGE_MAX_EDGE}`
            : `${width}×${height}`
        console.log(`✓ ${path.relative(baseDir, outputFile)}  (${tag})`)
    }
}

/**
 * Videos — ffmpeg libvpx-vp9 webm，无音轨，两档输出：
 *   1) 源文件 → 720p 桌面版  <name>-compressed.webm
 *   2) 桌面版 → 540p 移动版  <name>-mobile.webm（约一半体积）
 *
 * 全屏背景视频（如 THREE.VideoTexture / CSS background）降到 720p/540p 感知
 * 损失很小。运行时按断点二选一，移动端只下 -mobile 那份。
 *
 * Step 1 改了源视频时才跑（按源文件名匹配，跳过已生成的 -compressed/-mobile）；
 * Step 2 永远从 -compressed.webm 复现移动版，可独立重跑。
 */
const ffmpegEncode = (inputFile, outputFile, extraVf) =>
    new Promise((resolve, reject) => {
        console.log('\n▶ Compressing:', path.basename(outputFile))

        const command = spawn('ffmpeg', [
            '-y',
            '-i',
            inputFile,

            // ===== 缩放 / 帧率 =====
            '-vf',
            extraVf,

            // ===== 视频编码 (VP9) =====
            '-c:v',
            'libvpx-vp9',
            '-crf',
            extraVf.includes('960') ? '38' : '36', // 540p 更狠一点
            '-b:v',
            '0', // 必须 0 才走 crf constant-quality 模式
            '-deadline',
            'good', // good = 平衡；best = 更慢质量更高
            '-cpu-used',
            '2', // 0-5，越小越慢质量越好
            '-row-mt',
            '1', // 多线程
            '-pix_fmt',
            'yuv420p',

            // ===== 去音轨 =====
            '-an',

            outputFile
        ])

        command.stderr.on('data', (data) => {
            const line = data.toString()
            if (
                line.includes('frame=') ||
                line.includes('error') ||
                line.includes('Error')
            ) {
                process.stdout.write(`  ${line.trim().slice(-120)}\r`)
            }
        })

        command.on('close', (code) => {
            if (code === 0) {
                console.log(`\n✓ Done: ${path.basename(outputFile)}`)
                resolve()
            } else {
                console.error(
                    `\n✗ Failed (code ${code}): ${path.basename(inputFile)}`
                )
                reject(new Error(`ffmpeg exited with code ${code}`))
            }
        })

        command.on('error', (err) => {
            console.error('\n✗ Spawn error:', err.message)
            reject(err)
        })
    })

// Step 1 — 源 → 720p 桌面版
{
    const files = await glob(`${baseDir}/video/**/*.{mp4,mov,webm,m4v}`, {
        ignore: ['**/*-compressed.*', '**/*-mobile.*']
    })
    console.log(`\n=== Videos (720p desktop): ${files.length} file(s) ===`)
    if (files.length === 0) console.log('  (none)')
    for (const inputFile of files) {
        const outputFile = inputFile.replace(
            /\.(mp4|mov|webm|m4v)$/i,
            '-compressed.webm'
        )
        await ffmpegEncode(inputFile, outputFile, 'scale=1280:-2')
    }
}

// Step 2 — 720p 桌面版 → 540p 移动版（可独立重跑）
{
    const files = await glob(`${baseDir}/video/**/*-compressed.webm`)
    console.log(`\n=== Videos (540p mobile): ${files.length} file(s) ===`)
    if (files.length === 0) console.log('  (none)')
    for (const inputFile of files) {
        const outputFile = inputFile.replace(/-compressed\.webm$/i, '-mobile.webm')
        await ffmpegEncode(inputFile, outputFile, 'scale=960:-2,fps=24')
    }
}
