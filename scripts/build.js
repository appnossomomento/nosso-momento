const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { minify } = require('html-minifier-terser');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const assetsSrc = path.join(rootDir, 'assets');
const assetsDest = path.join(distDir, 'assets');
const tailwindInput = path.join(rootDir, 'styles', 'input.css');
const tailwindConfig = path.join(rootDir, 'tailwind.config.js');
const tailwindBinary = path.join(
    rootDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tailwindcss.cmd' : 'tailwindcss'
);

const htmlMinifierOptions = {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: false,
    removeOptionalTags: false,
    useShortDoctype: true,
    minifyCSS: true,
    minifyJS: true
};

async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else if (entry.isFile()) {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

function buildTailwindCSS(outputPath) {
    if (!fsSync.existsSync(tailwindBinary)) {
        throw new Error('Tailwind CLI não encontrado. Execute "npm install" antes do build.');
    }

    const result = spawnSync(tailwindBinary, [
        '-c',
        tailwindConfig,
        '-i',
        tailwindInput,
        '-o',
        outputPath,
        '--minify'
    ], {
        stdio: 'inherit',
        shell: process.platform === 'win32'
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error('Falha ao gerar o CSS com o Tailwind CLI (código ' + result.status + ').');
    }
}

function replaceTailwindCDN(html) {
    const cdnPattern = /<script[^>]*src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/gi;
    return html.replace(cdnPattern, '<link rel="stylesheet" href="./assets/tailwind.css">');
}

async function buildHTMLFiles() {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    const htmlFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.html'));

    await Promise.all(htmlFiles.map(async (file) => {
        const srcPath = path.join(rootDir, file.name);
        const destPath = path.join(distDir, file.name);
        const rawHtml = await fs.readFile(srcPath, 'utf8');
        const processedHtml = replaceTailwindCDN(rawHtml);
        const minifiedHtml = await minify(processedHtml, htmlMinifierOptions);
        await fs.writeFile(destPath, minifiedHtml, 'utf8');
    }));
}

async function copyAuxiliaryFiles() {
    const candidates = ['firebase-messaging-sw.js'];

    for (const file of candidates) {
        const src = path.join(rootDir, file);
        if (await pathExists(src)) {
            const dest = path.join(distDir, file);
            await fs.copyFile(src, dest);
        }
    }
}

async function run() {
    try {
        await fs.rm(distDir, { recursive: true, force: true });
        await fs.mkdir(distDir, { recursive: true });

        if (await pathExists(assetsSrc)) {
            await copyDirectory(assetsSrc, assetsDest);
        } else {
            await fs.mkdir(assetsDest, { recursive: true });
        }

        buildTailwindCSS(path.join(assetsDest, 'tailwind.css'));
        await buildHTMLFiles();
        await copyAuxiliaryFiles();

        console.log('Build finalizado. Arquivos disponíveis em dist/.');
    } catch (error) {
        console.error('Erro ao executar o build:', error.message);
        process.exit(1);
    }
}

run();
