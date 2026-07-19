// 与后端 schema 对齐的类型
export interface UserOut {
  id: string;
  username: string;
  role: 'owner' | 'visitor';
  remark: string | null;
}

export interface CategoryOut {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  order: number;
}

export interface GroupOut {
  id: string;
  category_id: string;
  name: string;
  icon: string | null;
  order: number;
}

export interface ExperienceOut {
  id: string;
  category_id: string;
  group_id: string | null;
  title: string;
  summary: string | null;
  cover_url: string | null;
  has_cover: boolean;
  html_size: number;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface HtmlTokenOut {
  token: string;
  url: string;
  expires_in: number;
}

export interface VisitorOut {
  id: string;
  username: string;
  remark: string | null;
  status: 'active' | 'disabled';
  last_login_at: string | null;
  created_at: string;
}

export interface VisitorCreatedOut extends VisitorOut {
  initial_password: string;
}

export interface ManagedUserOut {
  id: string;
  username: string;
  role: 'owner' | 'visitor';
  remark: string | null;
  status: 'active' | 'disabled';
  last_login_at: string | null;
  created_at: string;
}

export interface ManagedUserCreatedOut extends ManagedUserOut {
  /** 自动生成或重置密码时返回，否则为 null。 */
  initial_password: string | null;
}

export interface ReorderItem {
  id: string;
  order: number;
}

export interface MoveItem {
  id: string;
  order: number;
  group_id?: string | null;
}

// ===== Search =====
export interface SearchHit {
  experience_id: string;
  title: string;
  summary: string | null;
  snippet: string; // 含 <mark>...</mark> 高亮（仅来源于受信元数据/正文，前端可安全渲染）
  score: number;
  category_id: string;
  category_slug: string;
  category_name: string;
  group_id: string | null;
  group_name: string | null;
}

export interface SearchResponse {
  query: string;
  mode: 'meta' | 'content';
  total: number;
  hits: SearchHit[];
}

// ===== Cover Presets =====
export interface CoverPresetOut {
  key: string;
  label: string;
  color: string;
  url: string;
}

// ===== 开放接口 (Open API) =====
export interface OpenTokenStatus {
  exists: boolean;
}

export interface OpenTokenOut {
  token: string;
  note: string;
}
