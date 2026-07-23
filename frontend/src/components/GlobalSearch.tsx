import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Input, Spin, Empty, Segmented, App as AntdApp } from 'antd';
import { SearchOutlined, FileSearchOutlined } from '@ant-design/icons';

import { categoryApi, experienceApi, searchApi } from '@/api';
import type { SearchHit } from '@/api/types';

interface Props {
  /** 移动端时父组件可让搜索框占满宽度 */
  fullWidth?: boolean;
  /** 触屏 placeholder 较短 */
  compact?: boolean;
}

/**
 * 全站搜索（顶栏中央）。
 * - 输入 250ms 防抖
 * - meta / content 两种模式切换
 * - 结果浮层：分类→分组→标题，点击直接打开 HTML 沙箱链接
 */
export default function GlobalSearch({ fullWidth = false, compact = false }: Props) {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [mode, setMode] = useState<'meta' | 'content'>('meta');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 250ms 防抖
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // 浮层外部点击关闭
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debouncedQ, mode],
    queryFn: () => searchApi.query(debouncedQ, mode, 30),
    enabled: debouncedQ.length >= 1,
    staleTime: 5_000,
  });

  // 用于跳转所需的 slug
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.list,
    staleTime: 60_000,
  });

  const slugById = useMemo(() => {
    const m = new Map<string, string>();
    (categories ?? []).forEach((c) => m.set(c.id, c.slug));
    return m;
  }, [categories]);

  const handleOpen = async (hit: SearchHit) => {
    setOpen(false);
    try {
      // 直接打开 HTML 沙箱（最直接的"看到内容"路径）
      const tk = await experienceApi.getHtmlToken(hit.experience_id);
      window.open(tk.url, '_blank', 'noopener,noreferrer');
    } catch {
      message.error('打开失败，请稍后重试');
    }
  };

  const handleJump = (hit: SearchHit) => {
    setOpen(false);
    const slug = slugById.get(hit.category_id) ?? hit.category_slug;
    if (slug) {
      // 用 hash 把目标卡片 id 带到主页，主页可滚动定位（增强项）
      navigate(`/c/${slug}#exp-${hit.experience_id}`);
    }
  };

  const hits = data?.hits ?? [];
  const showPanel = open && (debouncedQ.length >= 1 || isFetching);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : 'min(420px, 36vw)',
        maxWidth: '100%',
        flex: fullWidth ? 1 : '0 1 auto',
        minWidth: 0,
      }}
    >
      <Input
        placeholder={compact ? '搜索…' : '全站搜索 经验 / 分组 / 正文…'}
        prefix={<SearchOutlined style={{ color: 'var(--cy-text-faint)' }} />}
        allowClear
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onPressEnter={() => {
          if (hits.length > 0) handleOpen(hits[0]);
        }}
        style={{
          background: 'var(--cy-input-bg)',
          border: '1px solid var(--cy-glass-border)',
        }}
      />

      {showPanel && (
        <div
          className="cy-glass"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            maxHeight: 'min(70vh, 520px)',
            overflowY: 'auto',
            borderRadius: 12,
            zIndex: 200,
            padding: 12,
            boxShadow:
              '0 0 0 1px var(--cy-glass-border), 0 20px 60px -10px rgba(0, 0, 0, 0.6)',
          }}
        >
          {/* 模式切换 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Segmented
              size="small"
              value={mode}
              onChange={(v) => setMode(v as 'meta' | 'content')}
              options={[
                { label: '元数据', value: 'meta' },
                { label: '正文内容', value: 'content', icon: <FileSearchOutlined /> },
              ]}
            />
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: 'var(--cy-font-mono)',
                fontSize: 11,
                color: 'var(--cy-text-faint)',
              }}
            >
              {isFetching ? '搜索中…' : data ? `${data.total} 条结果` : ''}
            </span>
          </div>

          {/* 结果列表 */}
          {isFetching && hits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : debouncedQ.length === 0 ? (
            <div
              style={{
                fontFamily: 'var(--cy-font-mono)',
                fontSize: 12,
                color: 'var(--cy-text-faint)',
                padding: 16,
                textAlign: 'center',
                letterSpacing: '0.1em',
              }}
            >
              输入关键词开始搜索 · 按 Enter 打开第一项
            </div>
          ) : hits.length === 0 ? (
            <Empty
              imageStyle={{ height: 36 }}
              description={
                <span
                  style={{ color: 'var(--cy-text-faint)', fontFamily: 'var(--cy-font-mono)' }}
                >
                  没有找到「{debouncedQ}」相关内容
                </span>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {hits.map((hit) => (
                <div
                  key={hit.experience_id}
                  onClick={() => handleOpen(hit)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleJump(hit);
                  }}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--cy-line)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: 'var(--cy-result-item-bg)',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--cy-neon-pink)';
                    e.currentTarget.style.background = 'var(--cy-card-sheen)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--cy-line)';
                    e.currentTarget.style.background = 'var(--cy-result-item-bg)';
                  }}
                >
                  {/* 路径徽章 */}
                  <div
                    style={{
                      fontFamily: 'var(--cy-font-mono)',
                      fontSize: 11,
                      color: 'var(--cy-text-faint)',
                      marginBottom: 4,
                      letterSpacing: '0.05em',
                    }}
                  >
                    <span style={{ color: 'var(--cy-neon-cyan)' }}>
                      {hit.category_name || '—'}
                    </span>
                    {hit.group_name && (
                      <>
                        <span style={{ margin: '0 6px' }}>›</span>
                        <span>{hit.group_name}</span>
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--cy-text)',
                      fontSize: 14,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {hit.title}
                  </div>
                  {hit.snippet && (
                    <div
                      // 后端 snippet 内含 <mark>...</mark> 标签，已对其余字符做 SQLite 自身的转义；
                      // 我们在前端只渲染该字段，且后端已限定 snippet 仅来自 title/summary/group_name/html_text，
                      // 这些字段都来自数据库（标题/简介是用户输入的纯文本，HTML 已用 BeautifulSoup
                      // 提取为纯文本后再入索引），不会包含可执行 HTML，安全可控。
                      dangerouslySetInnerHTML={{ __html: hit.snippet }}
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        color: 'var(--cy-text-dim)',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}
                    />
                  )}
                </div>
              ))}

              <div
                style={{
                  marginTop: 4,
                  paddingTop: 8,
                  borderTop: '1px dashed var(--cy-line)',
                  fontFamily: 'var(--cy-font-mono)',
                  fontSize: 11,
                  color: 'var(--cy-text-faint)',
                  textAlign: 'center',
                  letterSpacing: '0.08em',
                }}
              >
                单击 → 打开文档 · 右键 → 跳到分类
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
