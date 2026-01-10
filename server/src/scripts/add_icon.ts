import * as ResEdit from 'resedit';
import * as fs from 'fs';
import * as path from 'path';
import pngToIco from 'png-to-ico';

const EXE_PATH = path.resolve(__dirname, '../../dist/twitch-automod-server.exe');
const PNG_PATH = path.resolve(__dirname, '../../../client/public/logo.png');
const ICO_PATH = path.resolve(__dirname, '../../dist/icon.ico');

console.log('--- Debug Paths ---');
console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);
console.log('EXE_PATH:', EXE_PATH);
console.log('PNG_PATH:', PNG_PATH);
console.log('ICO_PATH:', ICO_PATH);

async function main() {
    console.log('--- Icon Injection Start ---');

    // 1. Convert PNG to ICO
    console.log(`Converting ${PNG_PATH} to ICO...`);
    try {
        const icoBuffer = await pngToIco(PNG_PATH);
        fs.writeFileSync(ICO_PATH, icoBuffer);
        console.log('ICO created at:', ICO_PATH);
    } catch (e) {
        console.error('Failed to convert PNG to ICO:', e);
        process.exit(1);
    }

    // 2. Read EXE
    if (!fs.existsSync(EXE_PATH)) {
        console.error('Executable not found at:', EXE_PATH);
        process.exit(1);
    }
    const data = fs.readFileSync(EXE_PATH);

    // 3. Load into ResEdit
    console.log('Loading executable resources...');
    const exe = ResEdit.NtExecutable.from(data);
    const res = ResEdit.NtExecutableResource.from(exe);

    // 4. Create Icon Resource
    console.log('Injecting icon...');
    const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ICO_PATH));

    // Replace existing icon group (101 is usually the main icon ID)
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
        res.entries,
        1, // Icon Group ID (often 1 or 101)
        1033, // Language (en-US)
        iconFile.icons.map(item => item.data)
    );

    // 5. Rebuild EXE
    console.log('Rebuilding executable...');
    res.outputResource(exe);
    const newExe = exe.generate();

    // 6. Save
    fs.writeFileSync(EXE_PATH, Buffer.from(newExe));
    console.log('Icon injected successfully!');

    // Cleanup
    fs.unlinkSync(ICO_PATH);
    console.log('--- Icon Injection Complete ---');
}

main().catch(console.error);
