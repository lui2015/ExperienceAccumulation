import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Collapse,
  Form,
  Input,
  Modal,
  Space,
  App as AntdApp,
  Tag,
  Spin,
  Empty,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  PlusOutlined,
  FolderAddOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { categoryApi, groupApi } from '@/api';
import type { CategoryOut, GroupOut } from '@/api/types';
import { useIsMobile } from '@/hooks/useMediaQuery';
import EmojiPicker from '@/components/EmojiPicker';

/* ============================ 分类行（可拖拽） ============================ */

function CategoryRow({
  cat,
  onEdit,
  onDelete,
}: {
  cat: CategoryOut;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cat:${cat.id}`,
  });
  const isMobile = useIsMobile();
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      className="cy-glass"
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '10px 12px' : '12px 16px',
        borderRadius: 10,
        marginBottom: 10,
        gap: isMobile ? 8 : 0,
      }}
      {...attributes}
    >
      <span
        data-cy-drag-handle
        {...listeners}
        style={{
          cursor: 'grab',
          color: 'var(--cy-text-faint)',
          marginRight: isMobile ? 4 : 12,
          touchAction: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <HolderOutlined />
      </span>
      <span style={{ fontSize: isMobile ? 18 : 20, marginRight: isMobile ? 8 : 12 }}>
        {cat.icon ?? '📁'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            color: 'var(--cy-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {cat.name}
        </div>
        <Tag style={{ marginInlineEnd: 0, marginTop: 4 }}>/{cat.slug}</Tag>
      </div>
      <Space size={isMobile ? 4 : 8} onClick={(e) => e.stopPropagation()}>
        <Button
          icon={<EditOutlined />}
          size={isMobile ? 'small' : 'middle'}
          onClick={onEdit}
        >
          {isMobile ? '' : '编辑'}
        </Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          size={isMobile ? 'small' : 'middle'}
          onClick={onDelete}
        >
          {isMobile ? '' : '删除'}
        </Button>
      </Space>
    </div>
  );
}

/* ============================ 分组行（可拖拽） ============================ */

function GroupRow({
  g,
  onEdit,
  onDelete,
}: {
  g: GroupOut;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `grp:${g.id}`,
  });
  const isMobile = useIsMobile();
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '8px 10px' : '10px 14px',
        background: 'rgba(11, 13, 24, 0.55)',
        border: '1px solid rgba(124, 92, 255, 0.22)',
        borderRadius: 8,
        marginBottom: 8,
        gap: isMobile ? 6 : 0,
      }}
      {...attributes}
    >
      <span
        data-cy-drag-handle
        {...listeners}
        style={{
          cursor: 'grab',
          color: 'var(--cy-text-faint)',
          marginRight: isMobile ? 2 : 10,
          fontSize: 14,
          touchAction: 'none',
        }}
      >
        <HolderOutlined />
      </span>
      <span style={{ fontSize: 16, marginRight: isMobile ? 6 : 10 }}>{g.icon ?? '📂'}</span>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          color: 'var(--cy-text)',
          fontFamily: 'var(--cy-font-mono)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {g.name}
      </div>
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={onEdit}>
          {isMobile ? '' : '编辑'}
        </Button>
        <Button size="small" danger icon={<DeleteOutlined />} onClick={onDelete}>
          {isMobile ? '' : '删除'}
        </Button>
      </Space>
    </div>
  );
}

/* ============================ 分组管理子区块 ============================ */

function GroupManager({ category }: { category: CategoryOut }) {
  const qc = useQueryClient();
  const { modal, message } = AntdApp.useApp();

  const { data, isLoading } = useQuery({
    queryKey: ['groups', category.id],
    queryFn: () => groupApi.list(category.id),
  });
  const [items, setItems] = useState<GroupOut[]>([]);
  useEffect(() => {
    if (data) setItems(data.slice().sort((a, b) => a.order - b.order));
  }, [data]);

  const reorderMut = useMutation({
    mutationFn: groupApi.reorder,
    onError: () => {
      qc.invalidateQueries({ queryKey: ['groups', category.id] });
      message.error('保存顺序失败，已回滚');
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => `grp:${i.id}` === active.id);
    const newIdx = items.findIndex((i) => `grp:${i.id}` === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx).map((it, idx) => ({
      ...it,
      order: (idx + 1) * 1000,
    }));
    setItems(next);
    reorderMut.mutate(next.map((it) => ({ id: it.id, order: it.order })));
  };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GroupOut | null>(null);
  const [form] = Form.useForm();

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };
  const openEdit = (g: GroupOut) => {
    setEditing(g);
    form.setFieldsValue({ name: g.name, icon: g.icon ?? '' });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async (v: any) => {
      const data = { name: v.name.trim(), icon: v.icon?.trim() || null };
      if (editing) return groupApi.update(editing.id, data);
      return groupApi.create({ category_id: category.id, ...data });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', category.id] });
      setOpen(false);
      message.success(editing ? '已保存' : '已创建');
    },
  });

  const removeMut = useMutation({
    mutationFn: groupApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', category.id] });
      message.success('已删除');
    },
  });

  const handleDelete = (g: GroupOut) =>
    modal.confirm({
      title: `删除分组「${g.name}」？`,
      content: '若分组下仍有经验，将无法删除。',
      okType: 'danger',
      onOk: () => removeMut.mutateAsync(g.id),
    });

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <Button size="small" type="primary" icon={<FolderAddOutlined />} onClick={openCreate}>
          新增分组
        </Button>
      </div>

      {isLoading ? (
        <Spin />
      ) : items.length === 0 ? (
        <Empty
          description={
            <span style={{ color: 'var(--cy-text-faint)', fontFamily: 'var(--cy-font-mono)' }}>
              该分类下还没有分组
            </span>
          }
          imageStyle={{ height: 36 }}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={items.map((i) => `grp:${i.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((g) => (
              <GroupRow
                key={g.id}
                g={g}
                onEdit={() => openEdit(g)}
                onDelete={() => handleDelete(g)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      <Modal
        title={editing ? '编辑分组' : '新增分组'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          const v = await form.validateFields();
          saveMut.mutate(v);
        }}
        confirmLoading={saveMut.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="分组名称"
            rules={[{ required: true, max: 64, message: '请输入名称' }]}
          >
            <Input placeholder="例：仓位管理" maxLength={64} />
          </Form.Item>
          <Form.Item name="icon" label="图标 (emoji)">
            <EmojiPicker placeholder="点左侧选择，或手动输入" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/* ============================ 主页面 ============================ */

export default function CategoriesAdminPage() {
  const qc = useQueryClient();
  const { modal, message } = AntdApp.useApp();
  const [items, setItems] = useState<CategoryOut[]>([]);

  const { data, isLoading } = useQuery({ queryKey: ['categories'], queryFn: categoryApi.list });
  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  const reorderMut = useMutation({
    mutationFn: categoryApi.reorder,
    onError: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      message.error('保存顺序失败，已回滚');
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => `cat:${i.id}` === active.id);
    const newIdx = items.findIndex((i) => `cat:${i.id}` === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx).map((it, idx) => ({
      ...it,
      order: (idx + 1) * 1000,
    }));
    setItems(next);
    reorderMut.mutate(next.map((it) => ({ id: it.id, order: it.order })));
  };

  /* 分类的 CRUD */
  const [editing, setEditing] = useState<CategoryOut | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };
  const openEdit = (cat: CategoryOut) => {
    setEditing(cat);
    form.setFieldsValue(cat);
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async (values: any) => {
      if (editing) return categoryApi.update(editing.id, values);
      return categoryApi.create(values);
    },
    onSuccess: () => {
      message.success(editing ? '已保存' : '已创建');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const removeMut = useMutation({
    mutationFn: categoryApi.remove,
    onSuccess: () => {
      message.success('已删除');
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const handleDelete = (cat: CategoryOut) =>
    modal.confirm({
      title: `确认删除分类「${cat.name}」？`,
      content: '若分类下仍有经验文档或分组，将无法删除。',
      okType: 'danger',
      onOk: () => removeMut.mutateAsync(cat.id),
    });

  /* Collapse 项 */
  const collapseItems = useMemo(
    () =>
      items.map((cat) => ({
        key: cat.id,
        label: <CategoryRow cat={cat} onEdit={() => openEdit(cat)} onDelete={() => handleDelete(cat)} />,
        children: <GroupManager category={cat} />,
        showArrow: true,
      })),
    [items], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (isLoading) return <Spin />;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
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
            <span style={{ color: 'var(--cy-neon-cyan)' }}>$</span> manage ./categories --recursive
          </div>
          <h2
            className="cy-neon-title"
            style={{ fontSize: 22, margin: '8px 0 0', letterSpacing: '0.12em' }}
          >
            CATEGORY · CONFIG
          </h2>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增分类
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={items.map((i) => `cat:${i.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <Collapse
            ghost
            items={collapseItems}
            style={{ background: 'transparent' }}
            expandIconPosition="end"
          />
        </SortableContext>
      </DndContext>

      <Modal
        title={editing ? '编辑分类' : '新增分类'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          const v = await form.validateFields();
          saveMut.mutate(v);
        }}
        confirmLoading={saveMut.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: '请输入名称' }, { max: 64 }]}
          >
            <Input placeholder="例：读书笔记" maxLength={64} />
          </Form.Item>
          <Form.Item
            name="slug"
            label="URL 标识 (slug)"
            extra="用于 URL，如 /c/reading；仅小写字母、数字、连字符"
            rules={[
              { required: true, message: '请输入 slug' },
              { pattern: /^[a-z0-9][a-z0-9-]*$/, message: '格式不合法' },
            ]}
          >
            <Input placeholder="例：reading" />
          </Form.Item>
          <Form.Item name="icon" label="图标（emoji）">
            <EmojiPicker placeholder="点左侧选择，或手动输入" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
