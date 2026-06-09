// ============================================================
// 图片导出工具
// 使用 html2canvas 将 DOM 元素导出为图片，支持隐私模式模糊
// ============================================================

// @ts-ignore
import html2canvas from 'html2canvas';

export interface ExportOptions {
  filename?: string;
  quality?: number;
  privacyMode?: boolean;
  blurSensitiveData?: boolean;
}

/**
 * 图片导出工具类
 */
export class ImageExporter {

  /**
   * 导出元素为图片
   * @param element 要导出的DOM元素
   * @param options 导出选项
   */
  static async exportElement(
    element: HTMLElement,
    options: ExportOptions = {}
  ): Promise<void> {
    const {
      filename = 'mp-data-export.png',
      quality = 0.9,
      privacyMode = false,
      blurSensitiveData = true
    } = options;

    try {
      // 创建克隆元素进行预处理
      const clonedElement = element.cloneNode(true) as HTMLElement;
      
      // 设置克隆元素的样式
      clonedElement.style.padding = '8px';
      clonedElement.style.background = '#f5f7fa';
      clonedElement.style.width = '600px';
      clonedElement.style.boxSizing = 'border-box';
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-9999px';
      clonedElement.style.top = '0';
      clonedElement.style.zIndex = '-1';
      clonedElement.style.opacity = '1';
      clonedElement.style.transform = 'none';
      // 确保元素可见但不在视窗内

      // 添加隐藏类，具体隐藏逻辑在onclone中处理
      clonedElement.classList.add('export-hide');

      // 如果启用隐私模式，处理敏感数据
      if (privacyMode && blurSensitiveData) {
        this.processSensitiveData(clonedElement);
      }

      // 添加标题和时间戳（简化版本）
      this.addHeaderAndFooter(clonedElement);

      // 将克隆元素添加到DOM中
      document.body.appendChild(clonedElement);

      // 等待DOM更新完成，确保内容完全渲染
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 强制重新计算布局，让html2canvas自动计算尺寸
      clonedElement.style.height = 'auto';
      clonedElement.style.minHeight = 'auto';
      clonedElement.style.maxHeight = 'none';

      try {
        // 使用html2canvas生成图片 - 高清配置
        const canvas = await html2canvas(clonedElement, {
          backgroundColor: '#ffffff',
          scale: 1.1, // 提升清晰度
          useCORS: false,
          allowTaint: true,
          logging: false,
          // 不设置固定宽高，让html2canvas自动计算
          removeContainer: true,
          foreignObjectRendering: false,
          imageTimeout: 0,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc) => {
            // 在克隆文档中进一步优化
            const clonedBody = clonedDoc.body;
            if (clonedBody) {
              // 移除所有脚本和样式表
              const scripts = clonedBody.querySelectorAll('script');
              scripts.forEach(script => script.remove());
              
              // 简化样式 - 优化动态高度渲染
              const style = clonedDoc.createElement('style');
              style.textContent = `
                * { box-sizing: border-box !important; }
                body { 
                  margin: 0 !important; 
                  padding: 0 !important; 
                  height: auto !important;
                  min-height: auto !important;
                }
                .export-hide {
                  height: auto !important;
                  min-height: auto !important;
                  max-height: none !important;
                  overflow: visible !important;
                }
                .export-hide .toolbar,
                .export-hide .toolbar-row,
                .export-hide .card-actions,
                .export-hide .action-btn,
                .export-hide .el-input,
                .export-hide .el-select,
                .export-hide .el-button,
                .export-hide .el-dropdown,
                .export-hide .el-dropdown-menu,
                .export-hide .el-tooltip,
                .export-hide .icon-btn,
                .export-hide .compact,
                .export-hide .el-card__footer,
                .export-hide .expand-icon,
                .export-hide .el-button--text {
                  display: none !important;
                }
              `;
              clonedBody.appendChild(style);
            }
          },
          ignoreElements: (el) => {
            return (el as HTMLElement).style.display === 'none';
          }
        });

        // 直接使用toDataURL，高清输出
        const dataURL = canvas.toDataURL('image/png', Math.min(quality, 1.0));
        this.downloadDataURL(dataURL, filename);

      } finally {
        // 清理克隆元素
        if (document.body.contains(clonedElement)) {
          document.body.removeChild(clonedElement);
        }
      }
    } catch (error) {
      console.error('导出图片失败:', error);
      throw new Error('导出图片失败，请重试');
    }
  }

  /**
   * 处理敏感数据（脱敏处理）- 优化版本
   * @param element 目标元素
   */
  private static processSensitiveData(element: HTMLElement): void {
    // 使用CSS类进行批量处理，提高性能
    const sensitiveStyle = document.createElement('style');
    sensitiveStyle.textContent = `
      .privacy-mask .username,
      .privacy-mask .user-level,
      .privacy-mask .site-name,
      .privacy-mask .privacy-blur {
        background-color: rgba(0, 0, 0, 0.1) !important;
        color: #999 !important;
        border-radius: 4px !important;
        padding: 2px 6px !important;
        font-family: monospace !important;
        letter-spacing: 1px !important;
      }
      .privacy-mask .site-logo,
      .privacy-mask .el-avatar,
      .privacy-mask img {
        background-color: rgba(0, 0, 0, 0.2) !important;
        color: #666 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 32px !important;
        min-width: 32px !important;
      }
    `;
    element.appendChild(sensitiveStyle);
    element.classList.add('privacy-mask');

    // 快速处理文本内容
    const sensitiveSelectors = ['.username', '.user-level', '.site-name', '.privacy-blur'];
    sensitiveSelectors.forEach(selector => {
      element.querySelectorAll(selector).forEach(el => {
        const htmlEl = el as HTMLElement;
        const originalText = htmlEl.textContent || '';
        if (originalText.trim()) {
          htmlEl.textContent = '😜😜😜😜';
        }
      });
    });

    // 快速处理图片
    element.querySelectorAll('.site-logo, .el-avatar, img').forEach(el => {
      const htmlEl = el as HTMLElement;
      htmlEl.innerHTML = '<span style="font-size: 40px;">😁</span>';
    });
  }


  /**
   * 添加标题和页脚 - 优化版本
   * @param element 目标元素
   */
  private static addHeaderAndFooter(element: HTMLElement): void {
    // 使用CSS类批量设置样式，减少DOM操作
    const headerFooterStyle = document.createElement('style');
    headerFooterStyle.textContent = `
      .export-header {
        text-align: center;
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 12px;
        color: #333;
      }
      .export-footer {
        text-align: right;
        font-size: 13px;
        color: #888;
        margin-top: 16px;
        margin-bottom: 16px;
      }
    `;
    element.appendChild(headerFooterStyle);

    // 添加标题
    const header = document.createElement('div');
    header.className = 'export-header';
    header.textContent = 'MoviePilot 站点数据';
    element.insertBefore(header, element.firstChild);

    // 添加时间戳
    const footer = document.createElement('div');
    footer.className = 'export-footer';
    const now = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    footer.textContent = `${now} 导出自 MoviePilot Tools`;
    element.appendChild(footer);
  }

  /**
   * 下载DataURL
   * @param dataURL 图片数据URL
   * @param filename 文件名
   */
  private static downloadDataURL(dataURL: string, filename: string): void {
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }



  /**
   * 检查是否支持隐私模式
   */
  static isPrivacyModeSupported(): boolean {
    return typeof document !== 'undefined' && 'querySelector' in document;
  }

  /**
   * 获取默认导出文件名
   * @param type 数据类型
   */
  static getDefaultFilename(type: 'dashboard' | 'sites' | 'data' = 'data'): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    return `mp-${type}-${timestamp}.png`;
  }
}
