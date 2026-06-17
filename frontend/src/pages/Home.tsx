import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Empty, Tabs, Button, Form, Input, Modal, Space, Spin, App as AntdApp } from 'antd';
import { PlusOutlined, FolderAddOutlined } from '@ant-design/icons';
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';

import { categoryApi, experienceApi, groupApi } from '@/api';
import type { ExperienceOut, GroupOut } from '@/api/types';
import { useAuthStore } from '@/store/auth';
import GroupSection from '@/components/GroupSection';
import ExperienceDrawer from '@/components/ExperienceDrawer';

const NONE_DROPPABLE = 'group:__none__';
const NONE_KEY = '__none__';

/** 把分组与经验数据组装成 { groupKey: ExperienceOut[] }，groupKey 为 group.id 或 NONE_KEY */
function buildBuckets(experiences: ExperienceOut[], groups: GroupOut[]) {
  const buckets: Record<string, ExperienceOut[]> = { [NONE_KEY]: [] };
  groups.forEach((g) => (buckets[g.id] = []));
  experiences.forEach((e) => {
    const key = e.group_id ?? NONE_KEY;
    if (!buckets[key]) buckets[key] = []; // 容错：分组被删但经验未迁移
    buckets[key].push(e);
  });
  // 每桶内按 order 升序
  Object.values(buckets).forEach((arr) => arr.sort((a, b) => a.order - b.order));
  return buckets;
}

function getBucketKeyOf(id: UniqueIdentifier, buckets: Record<string, ExperienceOut[]>) {
  // id 可能是分组容器（"group:xxx"）或卡片 id
  const s = String(id);
  if (s.startsWith('group:')) return s === NONE_DROPPABLE ? NONE_KEY : s.slice('group:'.length);
  for (const [k, arr] of Object.entries(buckets)) {
    if (arr.find((e) => e.id === s)) return k;
  }
  return null;
}

export default function HomePage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const isOwner = useAuthStore((s) => s.isOwner)();
  const qc = useQueryClient();
  const { modal, message } = AntdApp.useApp();

  // 1) 分类
  const categoriesQ = useQuery({ queryKey: ['categories'], queryFn: categoryApi.list });
  const categories = categoriesQ.data ?? [];

  const activeCat = useMemo(() => {
    if (!categories.length) return null;
    if (slug) return categories.find((c) => c.slug === slug) ?? categories[0];
    return categories[0];
  }, [categories, slug]);

  useEffect(() => {
    if (activeCat && !slug) navigate(`/c/${activeCat.slug}`, { replace: true });
  }, [activeCat, slug, navigate]);

  // 2) 该分类下的分组
  const groupsQ = useQuery({
    queryKey: ['groups', activeCat?.id],
    queryFn: () => groupApi.list(activeCat!.id),
    enabled: !!activeCat,
  });
  const groups = useMemo(
    () => (groupsQ.data ?? []).slice().sort((a, b) => a.order - b.order),
    [groupsQ.data],
  );

  // 3) 经验
  const expQ = useQuery({
    queryKey: ['experiences', activeCat?.id],
    queryFn: () => experienceApi.list(activeCat!.id),
    enabled: !!activeCat,
  });

  // 本地 buckets（拖拽时乐观更新）
  const [buckets, setBuckets] = useState<Record<string, ExperienceOut[]>>({});
  useEffect(() => {
    if (expQ.data && groups) setBuckets(buildBuckets(expQ.data, groups));
  }, [expQ.data, groups]);

  // 4) 拖拽
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const reorderMut = useMutation({
    mutationFn: experienceApi.reorder,
    onError: () => {
      message.error('保存排序失败，已回滚');
      expQ.refetch();
    },
  });

  const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id);

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const fromKey = getBucketKeyOf(active.id, buckets);
    const toKey = getBucketKeyOf(over.id, buckets);
    if (!fromKey || !toKey) return;

    const fromArr = [...(buckets[fromKey] ?? [])];
    const toArr = fromKey === toKey ? fromArr : [...(buckets[toKey] ?? [])];

    const fromIdx = fromArr.findIndex((x) => x.id === active.id);
    if (fromIdx < 0) return;
    const moving = fromArr[fromIdx];

    // 计算放置位置
    let toIdx: number;
    if (String(over.id).startsWith('group:')) {
      // 拖到空白容器，放末尾
      toIdx = toArr.length;
    } else {
      toIdx = toArr.findIndex((x) => x.id === over.id);
      if (toIdx < 0) toIdx = toArr.length;
    }

    // 先从源移除
    fromArr.splice(fromIdx, 1);
    // 同桶时索引可能因移除变化
    if (fromKey === toKey && fromIdx < toIdx) toIdx -= 1;

    // 更新 group_id
    const updated: ExperienceOut = {
      ...moving,
      group_id: toKey === NONE_KEY ? null : toKey,
    };

    // 插入目标桶
    if (fromKey === toKey) {
      fromArr.splice(toIdx, 0, updated);
    } else {
      toArr.splice(toIdx, 0, updated);
    }

    // 写回 buckets（重新计算 order）
    const nextBuckets = { ...buckets };
    if (fromKey === toKey) {
      nextBuckets[fromKey] = fromArr.map((it, idx) => ({ ...it, order: (idx + 1) * 1000 }));
    } else {
      nextBuckets[fromKey] = fromArr.map((it, idx) => ({ ...it, order: (idx + 1) * 1000 }));
      nextBuckets[toKey] = toArr.map((it, idx) => ({ ...it, order: (idx + 1) * 1000 }));
    }
    setBuckets(nextBuckets);

    // 收集变更项
    const changed = [];
    if (fromKey === toKey) {
      changed.push(
        ...nextBuckets[fromKey].map((it) => ({
          id: it.id,
          order: it.order,
        })),
      );
    } else {
      // 跨组：源桶仅 order 变；目标桶含被移动项的 group_id
      changed.push(
        ...nextBuckets[fromKey].map((it) => ({ id: it.id, order: it.order })),
        ...nextBuckets[toKey].map((it) => ({
          id: it.id,
          order: it.order,
          // 仅对发生分组变更的项带 group_id（这里全带也无害）
          group_id: it.group_id,
        })),
      );
    }
    reorderMut.mutate(changed);
  };

  // 5) 经验抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ExperienceOut | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (exp: ExperienceOut) => {
    setEditing(exp);
    setDrawerOpen(true);
  };

  // 6) 删除
  const removeMut = useMutation({
    mutationFn: experienceApi.remove,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['experiences', activeCat?.id] });
      const close = message.loading({
        content: (
          <Space>
            已删除
            <a
              onClick={() => {
                experienceApi.restore(id).then(() => {
                  qc.invalidateQueries({ queryKey: ['experiences', activeCat?.id] });
                  message.success('已撤销删除');
                });
              }}
            >
              撤销
            </a>
          </Space>
        ),
        duration: 5,
        key: `del-${id}`,
      });
      setTimeout(() => close(), 5500);
    },
  });

  const handleDelete = (exp: ExperienceOut) => {
    modal.confirm({
      title: `确认删除《${exp.title}》？`,
      content: '5 秒内可撤销，超过后不可恢复。',
      okType: 'danger',
      okText: '删除',
      cancelText: '取消',
      onOk: () => removeMut.mutateAsync(exp.id),
    });
  };

  // 7) 新增分组（快捷入口，复杂管理在 /admin/categories）
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [groupForm] = Form.useForm();
  const createGroupMut = useMutation({
    mutationFn: groupApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', activeCat?.id] });
      setAddGroupOpen(false);
      groupForm.resetFields();
      message.success('已创建分组');
    },
  });

  const removeGroupMut = useMutation({
    mutationFn: groupApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', activeCat?.id] });
      message.success('分组已删除');
    },
  });

  const updateGroupMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => groupApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', activeCat?.id] });
      message.success('已保存');
    },
  });

  const editGroupInline = (g: GroupOut) => {
    let nextName = g.name;
    let nextIcon = g.icon ?? '';
    modal.confirm({
      title: '编辑分组',
      okText: '保存',
      content: (
        <Form layout="vertical" initialValues={{ name: g.name, icon: g.icon ?? '' }}>
          <Form.Item label="名称" name="name">
            <Input
              defaultValue={g.name}
              maxLength={64}
              onChange={(e) => (nextName = e.target.value)}
            />
          </Form.Item>
          <Form.Item label="图标 (emoji)" name="icon">
            <Input
              defaultValue={g.icon ?? ''}
              maxLength={4}
              onChange={(e) => (nextIcon = e.target.value)}
            />
          </Form.Item>
        </Form>
      ),
      onOk: () =>
        updateGroupMut.mutateAsync({
          id: g.id,
          data: { name: nextName.trim() || g.name, icon: nextIcon.trim() || null },
        }),
    });
  };

  const deleteGroupInline = (g: GroupOut) => {
    modal.confirm({
      title: `删除分组「${g.name}」？`,
      content: '若分组下仍有经验，请先迁移或删除内容。',
      okType: 'danger',
      onOk: () => removeGroupMut.mutateAsync(g.id),
    });
  };

  // 8) 渲染
  if (categoriesQ.isLoading) return <Spin />;
  if (!categories.length) return <Empty description="还没有分类，请在「分类管理」中新建" />;

  // 渲染顺序：先所有 groups，最后未分组（若有内容）
  const sectionGroups: (GroupOut | null)[] = [...groups];
  if ((buckets[NONE_KEY]?.length ?? 0) > 0 || sectionGroups.length === 0) {
    sectionGroups.push(null);
  }

  const allCardIds = Object.values(buckets).flatMap((arr) => arr.map((x) => x.id));
  const activeExp = activeId
    ? Object.values(buckets).flatMap((a) => a).find((x) => x.id === activeId)
    : null;

  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--cy-font-mono)',
          fontSize: 12,
          color: 'var(--cy-text-faint)',
          marginBottom: 18,
          letterSpacing: '0.16em',
        }}
      >
        <span style={{ color: 'var(--cy-neon-cyan)' }}>$</span> ls ./knowledge --tree
        <span className="cy-blink" style={{ marginLeft: 8 }}>
          ▍
        </span>
      </div>

      <Tabs
        className="cy-tabs"
        activeKey={activeCat?.id}
        onChange={(id) => {
          const c = categories.find((x) => x.id === id);
          if (c) navigate(`/c/${c.slug}`);
        }}
        items={categories.map((c) => ({
          key: c.id,
          label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {c.icon ? <span style={{ fontSize: 16 }}>{c.icon}</span> : null}
              <span>{c.name}</span>
            </span>
          ),
        }))}
        tabBarExtraContent={
          isOwner ? (
            <Space>
              <Button icon={<FolderAddOutlined />} onClick={() => setAddGroupOpen(true)}>
                新增分组
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                新增经验
              </Button>
            </Space>
          ) : null
        }
      />

      {expQ.isLoading ? (
        <Spin />
      ) : allCardIds.length === 0 && groups.length === 0 ? (
        <div style={{ padding: '64px 0', textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--cy-font-mono)',
              color: 'var(--cy-text-faint)',
              letterSpacing: '0.2em',
              fontSize: 13,
            }}
          >
            ＜ NO_DATA / EMPTY_NODE ＞
          </div>
          <div style={{ marginTop: 12, color: 'var(--cy-text-dim)' }}>
            {isOwner
              ? '点击右上角「新增分组」整理结构，或直接「新增经验」'
              : '该分类下暂无内容'}
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          {sectionGroups.map((g) => {
            const key = g ? g.id : NONE_KEY;
            return (
              <GroupSection
                key={key}
                group={g}
                experiences={buckets[key] ?? []}
                draggable={isOwner}
                isOwner={isOwner}
                onEditExperience={isOwner ? openEdit : undefined}
                onDeleteExperience={isOwner ? handleDelete : undefined}
                onEditGroup={isOwner && g ? () => editGroupInline(g) : undefined}
                onDeleteGroup={isOwner && g ? () => deleteGroupInline(g) : undefined}
              />
            );
          })}
        </DndContext>
      )}

      {/* 新增经验抽屉 */}
      {activeCat && (
        <ExperienceDrawer
          open={drawerOpen}
          experience={editing}
          categories={categories}
          groups={groups}
          defaultCategoryId={activeCat.id}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => {
            setDrawerOpen(false);
            qc.invalidateQueries({ queryKey: ['experiences', activeCat.id] });
          }}
        />
      )}

      {/* 新增分组弹窗 */}
      <Modal
        title="新增分组"
        open={addGroupOpen}
        onCancel={() => setAddGroupOpen(false)}
        onOk={async () => {
          const v = await groupForm.validateFields();
          createGroupMut.mutate({
            category_id: activeCat!.id,
            name: v.name.trim(),
            icon: v.icon?.trim() || null,
          });
        }}
        confirmLoading={createGroupMut.isPending}
        destroyOnClose
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item
            name="name"
            label="分组名称"
            rules={[{ required: true, max: 64, message: '请输入名称' }]}
          >
            <Input placeholder="例：仓位管理 / 估值方法 / 复盘记录" maxLength={64} />
          </Form.Item>
          <Form.Item name="icon" label="图标（emoji，选填）">
            <Input placeholder="例：📐" maxLength={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
