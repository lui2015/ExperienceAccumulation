import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Checkbox,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
  App as AntdApp,
  Collapse,
} from 'antd';
import {
  DownloadOutlined,
  SearchOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  BorderOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { categoryApi, experienceApi } from '@/api';
import type { ExperienceOut } from '@/api/types';
import { useIsMobile } from '@/hooks/useMediaQuery';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DataExportPage() {
  const { message } = AntdApp.useApp();
  const isMobile = useIsMobile();

  // 拉取所有分类
  const { data: categories, isLoading: catLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.list,
  });

  // 为每个分类拉取经验列表
  const [allExperiences, setAllExperiences] = useState<ExperienceOut[]>([]);
  const [expLoading, setExpLoading] = useState(false);

  useEffect(() => {
    if (!categories?.length) return;
    let cancelled = false;
    setExpLoading(true);
    Promise.all(categories.map((c) => experienceApi.list(c.id)))
      .then((results) => {
        if (cancelled) return;
        setAllExperiences(results.flat());
      })
      .catch(() => {
        if (!cancelled) message.error('加载经验列表失败');
      })
      .finally(() => {
        if (!cancelled) setExpLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categories]);

  // 搜索过滤
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return allExperiences;
    const kw = search.toLowerCase();
    return allExperiences.filter(
      (e) =>
        e.title.toLowerCase().includes(kw) ||
        (e.summary && e.summary.toLowerCase().includes(kw)),
    );
  }, [allExperiences, search]);

  // 按分类分组
  const grouped = useMemo(() => {
    const map: Record<string, { catName: string; items: ExperienceOut[] }> = {};
    for (const e of filtered) {
      if (!map[e.category_id]) {
        const cat = categories?.find((c) => c.id === e.category_id);
        map[e.category_id] = { catName: cat?.name ?? e.category_id, items: [] };
      }
      map[e.category_id].items.push(e);
    }
    return Object.entries(map);
  }, [filtered, categories]);

  // 选择状态
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allIds = useMemo(() => filtered.map((e) => e.id), [filtered]);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === allIds.length && allIds.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleGroup = (ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = ids.every((id) => next.has(id));
      if (allIn) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // 下载
  const downloadMut = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const blob = await experienceApi.batchDownload(ids);
      // 触发浏览器下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'experiences-html.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => message.success('下载已开始'),
    onError: () => message.error('下载失败，请重试'),
  });

  const isLoading = catLoading || expLoading;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--cy-font-mono)',
              fontSize: 12,
              color: 'var(--cy-text-faint)',
              letterSpacing: '0.16em',
            }}
          >
            <span style={{ color: 'var(--cy-neon-cyan)' }}>$</span> export ./data --format zip
          </div>
          <h2
            className="cy-neon-title"
            style={{ fontSize: 22, margin: '8px 0 0', letterSpacing: '0.12em' }}
          >
            DATA · EXPORT
          </h2>
        </div>

        <Space wrap>
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--cy-text-faint)' }} />}
            placeholder="搜索经验标题..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: isMobile ? 160 : 220 }}
          />
          <Button onClick={toggleAll} disabled={allIds.length === 0}>
            {selected.size === allIds.length && allIds.length > 0 ? (
              <>
                <BorderOutlined /> 取消全选
              </>
            ) : (
              <>
                <CheckSquareOutlined /> 全选
              </>
            )}
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            disabled={selected.size === 0}
            loading={downloadMut.isPending}
            onClick={() => downloadMut.mutate()}
          >
            下载选中 ({selected.size})
          </Button>
        </Space>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : grouped.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--cy-text-faint)' }}>
          {search.trim() ? '没有匹配的经验' : '还没有任何经验文档'}
        </div>
      ) : (
        <Collapse
          ghost
          defaultActiveKey={grouped.map(([id]) => id)}
          style={{ background: 'transparent' }}
          items={grouped.map(([catId, { catName, items }]) => {
            const itemIds = items.map((e) => e.id);
            const allChecked = itemIds.every((id) => selected.has(id));
            const someChecked = itemIds.some((id) => selected.has(id));
            return {
              key: catId,
              label: (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={allChecked}
                    indeterminate={!allChecked && someChecked}
                    onChange={() => toggleGroup(itemIds)}
                  />
                  <Typography.Text strong style={{ color: 'var(--cy-text)' }}>
                    {catName}
                  </Typography.Text>
                  <Tag>{items.length} 个文档</Tag>
                </div>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {items.map((exp) => (
                    <div
                      key={exp.id}
                      className="cy-glass"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: isMobile ? '8px 12px' : '10px 16px',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleOne(exp.id)}
                    >
                      <Checkbox checked={selected.has(exp.id)} />
                      <FileTextOutlined
                        style={{ color: 'var(--cy-neon-cyan)', fontSize: 16 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 500,
                            color: 'var(--cy-text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {exp.title}
                        </div>
                        {exp.summary && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--cy-text-faint)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginTop: 2,
                            }}
                          >
                            {exp.summary}
                          </div>
                        )}
                      </div>
                      <Space size={12} style={{ flexShrink: 0 }}>
                        <Tag>{formatSize(exp.html_size)}</Tag>
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                        >
                          {dayjs(exp.updated_at).format('YYYY-MM-DD')}
                        </Typography.Text>
                      </Space>
                    </div>
                  ))}
                </div>
              ),
            };
          })}
        />
      )}
    </div>
  );
}
