import * as fs from 'fs';
import * as path from 'path';

/**
 * Puts the app logo on the Windows executable.
 *
 * Run BEFORE `npm run package`: pkg appends its payload to a cached Node binary and patching the
 * finished exe with resedit breaks that payload ("pkg/prelude/bootstrap.js:1 SyntaxError"). So the
 * icon is injected into the cached base binary instead (downloaded by pkg-fetch when missing);
 * every exe pkg builds from it afterwards carries the icon. Idempotent.
 */
const PNG_PATH = path.resolve(__dirname, '../../../client/public/logo.png');
const TARGET = { nodeRange: 'node22', platform: 'win', arch: 'x64' }; // keep in sync with package.json "pkg.targets"

async function main() {
    // ESM-only packages; load them at runtime.
    const ResEdit = await import('resedit');
    const { default: pngToIco } = await import('png-to-ico');
    const { need } = await import('@yao-pkg/pkg-fetch');

    console.log(`Fetching/locating the pkg base binary for ${TARGET.nodeRange}-${TARGET.platform}-${TARGET.arch}...`);
    const exePath = await need(TARGET);
    console.log('Base binary:', exePath);

    console.log(`Converting ${PNG_PATH} to ICO...`);
    const icoBuffer = await pngToIco(PNG_PATH);

    const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
    const res = ResEdit.NtExecutableResource.from(exe);
    const iconFile = ResEdit.Data.IconFile.from(icoBuffer);

    // Node's main icon group is id 1, en-US.
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
        res.entries,
        1,
        1033,
        iconFile.icons.map(item => item.data)
    );

    res.outputResource(exe);
    fs.writeFileSync(exePath, Buffer.from(exe.generate()));
    console.log('Icon injected into the base binary. Run `npm run package` to build the exe.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
