import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dropdown, Tooltip, App as AntdApp } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  HolderOutlined,
  MoreOutlined,
  FileTextOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';

import { experienceApi } from '@/api';
import type { ExperienceOut } from '@/api/types';
import ShareModal from './ShareModal';

interface Props {
  experience: ExperienceOut;
  draggable: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ExperienceCard({ experience, draggable, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: experience.id,
    disabled: !draggable,
  });
  const { message } = AntdApp.useApp();
  const [shareOpen, setShareOpen] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    // 触屏：禁用浏览器默认手势（避免长按选中/弹菜单影响拖拽）
    touchAction: draggable ? 'manipulation' : 'auto',
  };

  const openHtml = async () => {
    const hide = message.loading('正在签发访问 Token…', 0);
    try {
      const tk = await experienceApi.getHtmlToken(experience.id);
      hide();
      window.open(tk.url, '_blank', 'noopener,noreferrer');
    } catch {
      hide();
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} id={`exp-${experience.id}`}>
      <div className="cy-card" onClick={openHtml} style={{ cursor: 'pointer' }}>
        {/* 角标装饰 */}
        <span className="cy-corner tl" />
        <span className="cy-corner tr" />
        <span className="cy-corner bl" />
        <span className="cy-corner br" />

        {/* Cover */}
        <div
          className="cy-scanlines"
          style={{
            height: 150,
            position: 'relative',
            background: experience.has_cover && experience.cover_url
              ? `url(${experience.cover_url}) center/cover no-repeat`
              : 'linear-gradient(135deg, rgba(124, 92, 255, 0.2), rgba(255, 46, 195, 0.15) 50%, rgba(0, 229, 255, 0.15))',
          }}
        >
          {!experience.has_cover && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--cy-neon-cyan)',
                fontSize: 38,
                textShadow: '0 0 20px var(--cy-neon-cyan)',
              }}
            >
              <FileTextOutlined />
            </div>
          )}
          {/* 顶部细线 */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background: 'linear-gradient(90deg, var(--cy-neon-cyan), var(--cy-neon-pink))',
              opacity: 0.7,
            }}
          />
          {/* 大小标签 */}
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 10,
              fontFamily: 'var(--cy-font-mono)',
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(6, 7, 13, 0.7)',
              border: '1px solid rgba(0, 229, 255, 0.5)',
              color: 'var(--cy-neon-cyan)',
              letterSpacing: '0.08em',
            }}
          >
            {formatSize(experience.html_size)}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Tooltip title={experience.title}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                    color: 'var(--cy-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    letterSpacing: '0.02em',
                  }}
                >
                  {experience.title}
                </div>
              </Tooltip>
              {experience.summary && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: 'var(--cy-text-dim)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.5,
                  }}
                >
                  {experience.summary}
                </div>
              )}
            </div>

            {/* 右侧操作区：拖拽、分享、菜单（访客也始终能看到分享按钮） */}
            <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 2 }}>
              {draggable && (
                  <Tooltip title="按住拖动排序">
                    <span
                      data-cy-drag-handle
                      {...listeners}
                      style={{
                        cursor: 'grab',
                        padding: '4px 6px',
                        color: 'var(--cy-text-faint)',
                        touchAction: 'none', // 关键：让 dnd-kit 的 TouchSensor 接管
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cy-neon-cyan)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--cy-text-faint)')}
                    >
                      <HolderOutlined />
                    </span>
                  </Tooltip>
                )}
                {(onEdit || onDelete) && (
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        {
                          key: 'share',
                          icon: <ShareAltOutlined />,
                          label: '分享',
                          onClick: () => setShareOpen(true),
                        },
                        onEdit && {
                          key: 'edit',
                          icon: <EditOutlined />,
                          label: '编辑',
                          onClick: onEdit,
                        },
                        onDelete && {
                          key: 'delete',
                          icon: <DeleteOutlined />,
                          label: '删除',
                          danger: true,
                          onClick: onDelete,
                        },
                      ].filter(Boolean) as never,
                    }}
                  >
                    <span
                      style={{
                        cursor: 'pointer',
                        padding: '4px 6px',
                        color: 'var(--cy-text-faint)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cy-neon-pink)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--cy-text-faint)')}
                    >
                      <MoreOutlined />
                    </span>
                  </Dropdown>
                )}
                {/* 当无管理权限时（访客）依然展示分享按钮 */}
                {!(onEdit || onDelete) && (
                  <Tooltip title="分享">
                    <span
                      style={{
                        cursor: 'pointer',
                        padding: '4px 6px',
                        color: 'var(--cy-text-faint)',
                      }}
                      onClick={() => setShareOpen(true)}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cy-neon-cyan)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--cy-text-faint)')}
                    >
                      <ShareAltOutlined />
                    </span>
                  </Tooltip>
                )}
              </div>
          </div>
        </div>
      </div>
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        experienceId={experience.id}
        title={experience.title}
        summary={experience.summary}
      />
    </div>
  );
}
