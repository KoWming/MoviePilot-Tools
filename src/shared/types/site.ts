export interface Site {
  id?: number;
  name: string;
  domain: string;
  url: string;
  cookie?: string;
  ua?: string;
  apikey?: string;
  token?: string;
  proxy?: string;
  filter?: string;
  render?: string;
  public?: number;
  note?: string;
  timeout?: number;
  limit_interval?: number;
  limit_count?: number;
  limit_seconds?: number;
  is_active: boolean;
  pri: number;
  rss?: boolean;
  downloader?: boolean;
  created_at?: string;
  updated_at?: string;
  // 差异检测字段
  cookieDiff?: boolean;
  uaDiff?: boolean;
  // 禁用状态字段
  isDisabled?: boolean;
}

export interface SiteUserData {
  id?: number;
  site_id: number;
  domain: string;
  username?: string;
  user_level?: string;
  upload: number;
  download: number;
  ratio: number;
  seeding: number;
  seeding_size: number;
  leeching: number;
  leeching_size: number;
  bonus: number;
  join_at?: string;
  workdate: string;
  created_at?: string;
  updated_at?: string;
}

export interface SiteStatistic {
  id?: number;
  domain: string;
  lst_state: number;
  seconds: number;
  created_at?: string;
  updated_at?: string;
}

export interface SiteCategory {
  id: string;
  name: string;
  subcategories?: SiteCategory[];
}

export interface SiteAuth {
  site: string;
  params: Record<string, any>;
}

export interface SiteMapping {
  [domain: string]: string;
}
