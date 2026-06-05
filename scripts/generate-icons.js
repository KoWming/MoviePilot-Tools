import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const ICONS_DIR = path.join(__dirname, 'site_favicon');
const OUTPUT_FILE = path.join(__dirname, '../src/shared/data/siteIcons.ts');

// 确保输出目录存在
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 读取图标目录中的所有PNG文件
function generateIconsData() {
  try {
    const files = fs.readdirSync(ICONS_DIR);
    const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));
    
    console.log(`Found ${pngFiles.length} PNG files in ${ICONS_DIR}`);
    
    const iconsData = {};
    
    for (const file of pngFiles) {
      const filePath = path.join(ICONS_DIR, file);
      const fileName = path.parse(file).name; // 去掉扩展名
      
      try {
        // 读取文件并转换为Base64
        const fileBuffer = fs.readFileSync(filePath);
        const base64Data = fileBuffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64Data}`;
        
        iconsData[fileName] = dataUrl;
        console.log(`Processed: ${file} -> ${fileName}`);
      } catch (error) {
        console.error(`Error processing ${file}:`, error.message);
      }
    }
    
    // 生成TypeScript文件
    const tsContent = `// 自动生成的站点图标数据
// 生成时间: ${new Date().toISOString()}
// 图标数量: ${Object.keys(iconsData).length}

export interface SiteIconData {
  [domainPrefix: string]: string;
}

// 从域名中提取前缀，用于匹配图标文件名
function extractDomainPrefix(domain: string): string {
  // 移除协议和www前缀
  let cleanDomain = domain.replace(/^https?:\\/\\//, '').replace(/^www\\./, '');
  
  // 提取主域名部分（去掉顶级域名）
  const parts = cleanDomain.split('.');
  if (parts.length >= 2) {
    // 返回主域名部分，去掉顶级域名
    return parts[0];
  }
  
  return cleanDomain;
}

export const SITE_ICONS: SiteIconData = ${JSON.stringify(iconsData, null, 2)};

// 获取站点图标的辅助函数
export function getSiteIcon(domain: string): string | null {
  const prefix = extractDomainPrefix(domain);
  return SITE_ICONS[prefix] || null;
}
`;
    
    // 写入文件
    fs.writeFileSync(OUTPUT_FILE, tsContent, 'utf8');
    
    console.log(`\n✅ 成功生成图标数据文件: ${OUTPUT_FILE}`);
    console.log(`📊 处理了 ${Object.keys(iconsData).length} 个图标`);
    console.log(`📁 输出文件大小: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
    
    // 显示一些示例
    const sampleKeys = Object.keys(iconsData).slice(0, 5);
    console.log(`\n📋 示例图标: ${sampleKeys.join(', ')}`);
    
  } catch (error) {
    console.error('❌ 生成图标数据失败:', error.message);
    process.exit(1);
  }
}

// 运行脚本
generateIconsData();
