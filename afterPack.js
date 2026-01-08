const fs = require('fs-extra');
const path = require('path');

exports.default = async function(context) {
  const { appOutDir, arch, electronPlatformName } = context;
  
  // 获取架构名称
  const archName = arch === 1 ? 'x64' : 'arm64';
  console.log(`AfterPack: platform=${electronPlatformName}, arch=${archName}`);
  
  if (electronPlatformName === 'darwin') {
    const resourcesPath = path.join(appOutDir, 'PngCompress.app', 'Contents', 'Resources');
    const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '@img');
    
    // 源路径
    const sourceSharpPath = path.join(__dirname, 'node_modules', '@img', `sharp-darwin-${archName}`);
    const targetSharpPath = path.join(unpackedPath, `sharp-darwin-${archName}`);
    
    if (await fs.pathExists(sourceSharpPath)) {
      console.log(`Copying sharp-darwin-${archName} to unpacked...`);
      await fs.ensureDir(unpackedPath);
      await fs.copy(sourceSharpPath, targetSharpPath, { overwrite: true });
      console.log(`Done copying sharp-darwin-${archName}`);
    } else {
      console.log(`Warning: ${sourceSharpPath} not found`);
    }
  }
};
