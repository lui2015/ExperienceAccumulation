import { useEffect } from 'react';
import { Upload, Tabs, Spin, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import type { UploadFile } from 'antd/es/upload/interface';

import { coverPresetApi } from '@/api';
import type { CoverPresetOut } from '@/api/types';

interface Props {
  /** 已上传文件（Antd Upload fileList 形态） */
  fileList: UploadFile[];
  onFileListChange: (list: UploadFile[]) => void;
  /** 当前选中的预设 key；选中后会清空 fileList */
  presetKey: string | null;
  onPresetChange: (key: string | null) => void;
  /** 编辑模式下：是否已有封面（用于提示） */
  hasExistingCover?: boolean;
}

const TAB_UPLOAD = 'upload';
const TAB_PRESET = 'preset';

export default function CoverPicker({
  fileList,
  onFileListChange,
  presetKey,
  onPresetChange,
  hasExistingCover,
}: Props) {
  // 默认 Tab：已选预设 → preset；否则 upload
  const activeTab = presetKey ? TAB_PRESET : TAB_UPLOAD;

  const { data: presets, isLoading } = useQuery({
    queryKey: ['cover-presets'],
    queryFn: () => coverPresetApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  // 切到"预设"页时清空已选文件，避免双重写入
  useEffect(() => {
    if (presetKey && fileList.length > 0) onFileListChange([]);
  }, [presetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const normFile = (e: any) => (Array.isArray(e) ? e : e?.fileList ?? []);

  return (
    <Tabs
      activeKey={activeTab}
      onChange={(k) => {
        if (k === TAB_UPLOAD) {
          onPresetChange(null);
        } else {
          onFileListChange([]);
        }
      }}
      items={[
        {
          key: TAB_UPLOAD,
          label: '上传图片',
          children: (
            <Upload
              accept="image/jpeg,image/png,image/webp"
              maxCount={1}
              listType="picture-card"
              fileList={fileList}
              beforeUpload={() => false}
              onChange={(info) => {
                const list = normFile(info);
                onFileListChange(list);
                if (list.length > 0) onPresetChange(null);
              }}
            >
              {fileList.length === 0 ? '+ 上传' : null}
            </Upload>
          ),
        },
        {
          key: TAB_PRESET,
          label: '选择预设',
          children: isLoading ? (
            <Spin />
          ) : !presets || presets.length === 0 ? (
            <Empty description="暂无预设" />
          ) : (
            <PresetGrid
              presets={presets}
              selected={presetKey}
              onSelect={(key) => {
                onPresetChange(key);
                onFileListChange([]);
              }}
              onClear={() => onPresetChange(null)}
              hint={
                hasExistingCover && !presetKey
                  ? '提示：已有封面图，选择预设将替换它'
                  : undefined
              }
            />
          ),
        },
      ]}
    />
  );
}

function PresetGrid({
  presets,
  selected,
  onSelect,
  onClear,
  hint,
}: {
  presets: CoverPresetOut[];
  selected: string | null;
  onSelect: (key: string) => void;
  onClear: () => void;
  hint?: string;
}) {
  return (
    <div>
      {hint && (
        <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--cy-text-dim)' }}>{hint}</div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        {presets.map((p) => {
          const active = selected === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onSelect(p.key)}
              style={{
                position: 'relative',
                padding: 0,
                cursor: 'pointer',
                background: 'transparent',
                border: active
                  ? `2px solid ${p.color}`
                  : '1px solid var(--cy-glass-border)',
                borderRadius: 6,
                overflow: 'hidden',
                aspectRatio: '16 / 9',
                outline: 'none',
                boxShadow: active ? `0 0 12px ${p.color}` : 'none',
                transition: 'all 0.15s',
              }}
              aria-pressed={active}
              title={p.label}
            >
              <img
                src={p.url}
                alt={p.label}
                style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
                draggable={false}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: '3px 6px',
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  color: '#e6e8ff',
                  background: 'linear-gradient(transparent, rgba(6,7,13,0.85))',
                  textAlign: 'left',
                }}
              >
                {p.label}
              </span>
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 6,
                    fontSize: 10,
                    fontFamily: 'var(--cy-font-mono)',
                    color: p.color,
                    background: 'rgba(6,7,13,0.8)',
                    padding: '1px 6px',
                    borderRadius: 3,
                    border: `1px solid ${p.color}`,
                  }}
                >
                  ✓ 已选
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* 取消选中按钮 */}
      {selected && (
        <div style={{ marginTop: 10 }}>
          <a
            onClick={onClear}
            style={{ fontSize: 12, color: 'var(--cy-text-dim)' }}
          >
            清除选择
          </a>
        </div>
      )}
    </div>
  );
}
