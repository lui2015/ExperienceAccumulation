import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { Button, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, FolderOpenOutlined } from '@ant-design/icons';

import type { ExperienceOut, GroupOut } from '@/api/types';
import ExperienceCard from './ExperienceCard';

interface Props {
  /** 分组对象，null 表示"未分组"虚拟分组 */
  group: GroupOut | null;
  experiences: ExperienceOut[];
  draggable: boolean;
  isOwner: boolean;
  onEditExperience?: (exp: ExperienceOut) => void;
  onDeleteExperience?: (exp: ExperienceOut) => void;
  onEditGroup?: () => void;
  onDeleteGroup?: () => void;
}

/**
 * Tab 内的二级分组分区。
 * 每个分组是独立的 droppable 容器（id 形如 "group:xxx" 或 "group:__none__"）。
 */
export default function GroupSection({
  group,
  experiences,
  draggable,
  isOwner,
  onEditExperience,
  onDeleteExperience,
  onEditGroup,
  onDeleteGroup,
}: Props) {
  const droppableId = group ? `group:${group.id}` : 'group:__none__';
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  const isUnGrouped = group === null;

  return (
    <section style={{ marginTop: 24 }}>
      {/* 分组标题 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
          paddingBottom: 6,
          borderBottom: '1px dashed rgba(124, 92, 255, 0.25)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--cy-font-mono)',
            fontSize: 11,
            color: 'var(--cy-neon-cyan)',
            letterSpacing: '0.2em',
          }}
        >
          ▌
        </span>
        <span style={{ fontSize: 18 }}>{group?.icon ?? (isUnGrouped ? '📦' : '📂')}</span>
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: isUnGrouped ? 'var(--cy-text-dim)' : 'var(--cy-text)',
            letterSpacing: '0.05em',
            fontFamily: 'var(--cy-font-mono)',
          }}
        >
          {group?.name ?? '未分组'}
        </h3>
        <span
          style={{
            fontFamily: 'var(--cy-font-mono)',
            fontSize: 11,
            color: 'var(--cy-text-faint)',
          }}
        >
          [{experiences.length}]
        </span>

        <div style={{ flex: 1 }} />

        {isOwner && !isUnGrouped && (
          <div style={{ display: 'flex', gap: 4 }}>
            <Tooltip title="编辑分组">
              <Button size="small" type="text" icon={<EditOutlined />} onClick={onEditGroup} />
            </Tooltip>
            <Tooltip title="删除分组">
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={onDeleteGroup}
              />
            </Tooltip>
          </div>
        )}
      </div>

      {/* 分组容器（droppable） */}
      <SortableContext items={experiences.map((e) => e.id)} strategy={rectSortingStrategy}>
        <div
          ref={setNodeRef}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
            minHeight: 80,
            padding: 8,
            borderRadius: 10,
            border: `1px dashed ${
              isOver ? 'var(--cy-neon-pink)' : 'rgba(124, 92, 255, 0.15)'
            }`,
            background: isOver ? 'rgba(255, 46, 195, 0.05)' : 'transparent',
            transition: 'background 0.2s ease, border-color 0.2s ease',
          }}
        >
          {experiences.map((exp) => (
            <ExperienceCard
              key={exp.id}
              experience={exp}
              draggable={draggable}
              onEdit={onEditExperience ? () => onEditExperience(exp) : undefined}
              onDelete={onDeleteExperience ? () => onDeleteExperience(exp) : undefined}
            />
          ))}
          {experiences.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '24px 0',
                textAlign: 'center',
                fontFamily: 'var(--cy-font-mono)',
                fontSize: 12,
                color: 'var(--cy-text-faint)',
                letterSpacing: '0.15em',
              }}
            >
              <FolderOpenOutlined style={{ marginRight: 6 }} />
              {isOver ? '释放以放入此分组' : '空 · 拖动卡片到此处归入此分组'}
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
