import { createMpApiClient } from './client';
import { STORAGE_KEYS } from '../constants';

export interface DownloadingInfo {
  hash: string;
  name: string;
  title: string;
  size: number;
  progress: number;
  state: 'downloading' | 'paused' | 'completed' | 'error';
  upspeed: string;
  dlspeed: string;
  left_time: string;
  userid?: string;
  username?: string;
  media: {
    title: string;
    episode?: string;
    season?: string;
    image: string;
  };
  season_episode?: string;
}

export interface DownloaderConf {
  name: string;
  type: string;
  enabled: boolean;
}

export interface DirectoryInfo {
  name: string;
  storage: string;
  download_path: string;
  priority: number;
  monitor_type: string;
  media_type: string;
  media_category: string;
  transfer_type: string;
  library_storage: string;
  library_path: string;
  library_type_folder: boolean;
  overwrite_mode: string;
  library_category_folder: boolean;
  scraping: boolean;
  renaming: boolean;
  notify: boolean;
  monitor_mode: string;
  download_type_folder?: boolean;
  download_category_folder?: boolean;
}

export interface SiteInfo {
  id: number;
  name: string;
  domain: string;
  url: string;
  pri: number;
  rss: string | null;
  cookie: string;
  ua: string | null;
  apikey: string | null;
  token: string | null;
  proxy: number;
  filter: string | null;
  render: number;
  public: number;
  note: string | null;
  timeout: number;
  limit_interval: number;
  limit_count: number;
  limit_seconds: number;
  is_active: boolean;
  downloader: string | null;
}

export interface TorrentInfo {
  site?: number;
  site_name?: string;
  site_cookie?: string;
  site_ua?: string;
  site_proxy?: boolean;
  site_order?: number;
  site_downloader?: string;
  title: string;
  description?: string;
  imdbid?: string;
  enclosure: string;
  page_url: string;
  size?: number;
  seeders?: number;
  peers?: number;
  grabs?: number;
  pubdate?: string;
  date_elapsed?: string;
  freedate?: string;
  uploadvolumefactor?: number;
  downloadvolumefactor?: number;
  hit_and_run?: boolean;
  labels?: string[];
  pri_order?: number;
  volume_factor?: string;
  freedate_diff?: string;
}

export interface MediaInfo {
  title: string;
  year?: number;
  type: string;
  tmdbid?: number;
  doubanid?: string;
  poster_path?: string;
  backdrop_path?: string;
}

export interface AddDownloadRequest {
  torrent_in: TorrentInfo;
  media_in?: MediaInfo;
  downloader?: string;
  save_path?: string;
  label?: string;
}


class DownloadApi {
  private client;

  constructor() {
    this.client = createMpApiClient({
      baseURL: '',
      getToken: async (): Promise<string | undefined> => {
        // local 优先，sync 回退兼容旧版本
        const localData = await chrome.storage.local.get([STORAGE_KEYS.TOKEN]);
        if (localData[STORAGE_KEYS.TOKEN]) return localData[STORAGE_KEYS.TOKEN] as string;
        try {
          const syncData = await chrome.storage.sync.get([STORAGE_KEYS.TOKEN]);
          const syncToken = syncData[STORAGE_KEYS.TOKEN] as string | undefined;
          if (syncToken) {
            await chrome.storage.local.set({ [STORAGE_KEYS.TOKEN]: syncToken });
            return syncToken;
          }
        } catch {}
        return undefined;
      }
    });
  }

  private async getBaseURL(): Promise<string> {
    const localData = await chrome.storage.local.get([STORAGE_KEYS.BASE_URL]);
    if (localData[STORAGE_KEYS.BASE_URL]) return localData[STORAGE_KEYS.BASE_URL] as string;
    try {
      const syncData = await chrome.storage.sync.get([STORAGE_KEYS.BASE_URL]);
      const syncUrl = syncData[STORAGE_KEYS.BASE_URL] as string | undefined;
      if (syncUrl) {
        await chrome.storage.local.set({ [STORAGE_KEYS.BASE_URL]: syncUrl });
        return syncUrl;
      }
    } catch {}
    return '';
  }

  private async request<T>(method: string, url: string, data?: any): Promise<T> {
    const baseURL = await this.getBaseURL();
    this.client.defaults.baseURL = baseURL;
    
    let params: any = undefined;
    let body: any = data;
    if (data?.params) {
      params = data.params;
      const { params: _, ...rest } = data;
      body = Object.keys(rest).length > 0 ? rest : undefined;
    }
    
    const response = await this.client.request({
      method,
      url,
      data: body,
      params
    });
    
    return response.data;
  }

  // 获取正在下载的任务
  async getDownloading(name?: string): Promise<DownloadingInfo[]> {
    return this.request<DownloadingInfo[]>('GET', '/api/v1/download/', {
      params: { name }
    });
  }

  // 获取可用下载器
  async getDownloadClients(): Promise<DownloaderConf[]> {
    return this.request<DownloaderConf[]>('GET', '/api/v1/download/clients');
  }

  // 获取下载目录列表
  async getDirectories(): Promise<DirectoryInfo[]> {
    const response = await this.request<{ success: boolean; data: { value: DirectoryInfo[] } }>('GET', '/api/v1/system/setting/Directories');
    return response.data.value || [];
  }

  // 获取下载器完整配置（含 host/port/username/password）
  async getDownloaderConfigs(): Promise<{ name: string; type: string; enabled: boolean; config: Record<string, any> }[]> {
    const response = await this.request<{ success?: boolean; data?: { value?: any[] } }>('GET', '/api/v1/system/setting/Downloaders');
    const raw = response?.data?.value || [];
    return raw.map((d: any) => ({
      name: d.name,
      type: d.type,
      enabled: d.enabled,
      config: d.config || {}
    }));
  }

  // 获取站点配置列表
  async getSites(): Promise<SiteInfo[]> {
    const response = await this.request<SiteInfo[]>('GET', '/api/v1/site/');
    return response || [];
  }

  // 获取站点资源列表
  async getSiteResources(siteId: number, keyword?: string, cat?: string, page: number = 0): Promise<TorrentInfo[]> {
    const params = new URLSearchParams();
    if (keyword) params.append('keyword', keyword);
    if (cat) params.append('cat', cat);
    params.append('page', page.toString());
    
    const response = await this.request<TorrentInfo[]>(`GET`, `/api/v1/site/resource/${siteId}?${params.toString()}`);
    return response || [];
  }

  // 识别媒体信息
  async recognizeMedia(title: string, subtitle?: string): Promise<{ meta_info?: any; media_info?: any; torrent_info?: any }> {
    const params = new URLSearchParams();
    params.append('title', title);
    if (subtitle) params.append('subtitle', subtitle);
    
    const response = await this.request<{ meta_info?: any; media_info?: any; torrent_info?: any }>(`GET`, `/api/v1/media/recognize?${params.toString()}`);
    return response || {};
  }

  // 添加下载任务（含媒体信息）
  async addDownloadWithMedia(request: AddDownloadRequest): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request('POST', '/api/v1/download/', request);
  }

  // 添加下载任务（不含媒体信息）
  async addDownload(request: AddDownloadRequest): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request('POST', '/api/v1/download/add', request);
  }

  // 开始下载任务
  async startDownload(hashString: string, name?: string): Promise<{ success: boolean }> {
    return this.request('GET', `/api/v1/download/start/${hashString}`, {
      params: { name }
    });
  }

  // 暂停下载任务
  async stopDownload(hashString: string, name?: string): Promise<{ success: boolean }> {
    return this.request('GET', `/api/v1/download/stop/${hashString}`, {
      params: { name }
    });
  }

  // 删除下载任务
  async deleteDownload(hashString: string, name?: string): Promise<{ success: boolean }> {
    return this.request('DELETE', `/api/v1/download/${hashString}`, {
      params: { name }
    });
  }

}

export const downloadApi = new DownloadApi();
