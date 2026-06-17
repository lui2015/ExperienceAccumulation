import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  App as AntdApp,
} from 'antd';
import { DeleteOutlined, KeyOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { userApi } from '@/api';
import type { ManagedUserCreatedOut, ManagedUserOut } from '@/api/types';
import { useAuthStore } from '@/store/auth';
import { useIsMobile } from '@/hooks/useMediaQuery';

const ROLE_OPTIONS = [
  { label: '站主 (Owner)', value: 'owner' },
  { label: '访客 (Visitor)', value: 'visitor' },
];

/** 移动端用户卡片 */
function UserMobileCard({
  user,
  isSelf,
  onEdit,
  onResetPwd,
  onDelete,
  onToggleStatus,
}: {
  user: ManagedUserOut;
  isSelf: boolean;
  onEdit: () => void;
  onResetPwd: () => void;
  onDelete: () => void;
  onToggleStatus: (checked: boolean) => void;
}) {
  const isOwner = user.role === 'owner';
  return (
    <div
      style={{
        background: 'rgba(11, 13, 24, 0.55)',
        border: '1px solid rgba(124, 92, 255, 0.25)',
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--cy-font-mono)', fontWeight: 600, color: 'var(--cy-text)' }}>
          {user.username}
        </span>
        {isOwner ? (
          <Tag
            style={{
              marginInlineEnd: 0,
              background: 'linear-gradient(90deg, var(--cy-neon-purple), var(--cy-neon-pink))',
              color: '#06070d',
              border: 'none',
              fontWeight: 700,
            }}
          >
            OWNER
          </Tag>
        ) : (
          <Tag style={{ marginInlineEnd: 0 }}>VISITOR</Tag>
        )}
        {isSelf && (
          <Tag color="cyan" style={{ marginInlineEnd: 0 }}>
            你自己
          </Tag>
        )}
        <div style={{ flex: 1 }} />
        <Switch
          checked={user.status === 'active'}
          disabled={isSelf}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          size="small"
          onChange={onToggleStatus}
        />
      </div>

      {user.remark && (
        <div style={{ marginTop: 8, color: 'var(--cy-text-dim)', fontSize: 13 }}>
          {user.remark}
        </div>
      )}

      <div
        style={{
          marginTop: 8,
          fontFamily: 'var(--cy-font-mono)',
          fontSize: 11,
          color: 'var(--cy-text-faint)',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span>
          上次登录：
          {user.last_login_at ? dayjs(user.last_login_at).format('MM-DD HH:mm') : '未登录'}
        </span>
        <span>创建：{dayjs(user.created_at).format('YYYY-MM-DD')}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        <Button size="small" icon={<EditOutlined />} onClick={onEdit}>
          编辑
        </Button>
        <Button size="small" icon={<KeyOutlined />} onClick={onResetPwd}>
          重置密码
        </Button>
        <Button size="small" danger icon={<DeleteOutlined />} disabled={isSelf} onClick={onDelete}>
          删除
        </Button>
      </div>
    </div>
  );
}

export default function UsersAdminPage() {
  const qc = useQueryClient();
  const { modal, message } = AntdApp.useApp();
  const me = useAuthStore((s) => s.user);
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: userApi.list });

  // ----- 新增 -----
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const createMut = useMutation({
    mutationFn: userApi.create,
    onSuccess: (u) => {
      setCreateOpen(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ['users'] });
      if (u.initial_password) setCredModal(u);
      else message.success(`已创建账号 ${u.username}`);
    },
  });

  // ----- 编辑 -----
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUserOut | null>(null);
  const [editForm] = Form.useForm();

  const openEdit = (u: ManagedUserOut) => {
    setEditing(u);
    editForm.resetFields();
    editForm.setFieldsValue({ remark: u.remark ?? '', role: u.role, new_password: '' });
    setEditOpen(true);
  };

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => userApi.update(id, data),
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      if (u.initial_password) {
        setCredModal(u);
      } else {
        message.success('已保存');
      }
      setEditOpen(false);
    },
  });

  const removeMut = useMutation({
    mutationFn: userApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      message.success('已删除');
    },
  });

  // ----- 凭证展示 Modal -----
  const [credModal, setCredModal] = useState<ManagedUserCreatedOut | null>(null);

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
            <span style={{ color: 'var(--cy-neon-cyan)' }}>$</span> manage ./users
          </div>
          <h2
            className="cy-neon-title"
            style={{ fontSize: 22, margin: '8px 0 0', letterSpacing: '0.12em' }}
          >
            USER · ACCESS
          </h2>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          新增账号
        </Button>
      </div>

      <div className="cy-glass" style={{ borderRadius: 12, padding: isMobile ? 8 : 12 }}>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data ?? []).map((u) => (
              <UserMobileCard
                key={u.id}
                user={u}
                isSelf={u.id === me?.id}
                onEdit={() => openEdit(u)}
                onResetPwd={() =>
                  modal.confirm({
                    title: `重置 ${u.username} 的密码？`,
                    content: '将生成一个 12 位随机密码，旧密码立即失效。',
                    onOk: () =>
                      updateMut.mutateAsync({
                        id: u.id,
                        data: { reset_password: true },
                      }),
                  })
                }
                onDelete={() =>
                  modal.confirm({
                    title: `删除账号 ${u.username}？`,
                    content: '删除后该用户将无法登录，操作不可恢复。',
                    okType: 'danger',
                    onOk: () => removeMut.mutateAsync(u.id),
                  })
                }
                onToggleStatus={(checked) =>
                  updateMut.mutate({
                    id: u.id,
                    data: { status: checked ? 'active' : 'disabled' },
                  })
                }
              />
            ))}
            {!isLoading && (data ?? []).length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--cy-text-faint)',
                  padding: '24px 0',
                  fontFamily: 'var(--cy-font-mono)',
                }}
              >
                ＜ NO_USERS ＞
              </div>
            )}
          </div>
        ) : (
          <Table<ManagedUserOut>
          loading={isLoading}
          rowKey="id"
          dataSource={data ?? []}
          pagination={false}
          columns={[
            {
              title: '用户名',
              dataIndex: 'username',
              render: (v, row) => (
                <Space>
                  <span style={{ fontFamily: 'var(--cy-font-mono)' }}>{v}</span>
                  {row.id === me?.id && (
                    <Tag color="cyan" style={{ marginInlineEnd: 0 }}>
                      你自己
                    </Tag>
                  )}
                </Space>
              ),
            },
            {
              title: '角色',
              dataIndex: 'role',
              width: 110,
              render: (r) =>
                r === 'owner' ? (
                  <Tag
                    style={{
                      marginInlineEnd: 0,
                      background:
                        'linear-gradient(90deg, var(--cy-neon-purple), var(--cy-neon-pink))',
                      color: '#06070d',
                      border: 'none',
                      fontWeight: 700,
                    }}
                  >
                    OWNER
                  </Tag>
                ) : (
                  <Tag style={{ marginInlineEnd: 0 }}>VISITOR</Tag>
                ),
            },
            { title: '备注', dataIndex: 'remark', render: (v) => v ?? '-' },
            {
              title: '状态',
              dataIndex: 'status',
              width: 110,
              render: (s, row) => (
                <Switch
                  checked={s === 'active'}
                  disabled={row.id === me?.id}
                  checkedChildren="启用"
                  unCheckedChildren="禁用"
                  onChange={(checked) =>
                    updateMut.mutate({
                      id: row.id,
                      data: { status: checked ? 'active' : 'disabled' },
                    })
                  }
                />
              ),
            },
            {
              title: '最近登录',
              dataIndex: 'last_login_at',
              width: 160,
              render: (t) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : <Tag>未登录</Tag>),
            },
            {
              title: '创建',
              dataIndex: 'created_at',
              width: 110,
              render: (t) => dayjs(t).format('YYYY-MM-DD'),
            },
            {
              title: '操作',
              width: 280,
              render: (_, row) => (
                <Space size={4}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    icon={<KeyOutlined />}
                    onClick={() =>
                      modal.confirm({
                        title: `重置 ${row.username} 的密码？`,
                        content: '将生成一个 12 位随机密码，旧密码立即失效。',
                        onOk: () =>
                          updateMut.mutateAsync({
                            id: row.id,
                            data: { reset_password: true },
                          }),
                      })
                    }
                  >
                    重置密码
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={row.id === me?.id}
                    onClick={() =>
                      modal.confirm({
                        title: `删除账号 ${row.username}？`,
                        content: '删除后该用户将无法登录，操作不可恢复。',
                        okType: 'danger',
                        onOk: () => removeMut.mutateAsync(row.id),
                      })
                    }
                  >
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
        )}
      </div>

      {/* 新增账号 */}
      <Modal
        title="新增账号"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          const v = await createForm.validateFields();
          createMut.mutate({
            username: v.username.trim(),
            role: v.role,
            password: v.password?.trim() || null,
            remark: v.remark?.trim() || null,
          });
        }}
        confirmLoading={createMut.isPending}
        destroyOnClose
        okText="创建"
      >
        <Form form={createForm} layout="vertical" initialValues={{ role: 'visitor' }}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, min: 3, max: 64 },
              { pattern: /^[A-Za-z0-9_-]+$/, message: '仅允许字母、数字、下划线、连字符' },
            ]}
          >
            <Input placeholder="例：luli" autoFocus />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true }]}
            extra="站主拥有全部权限；访客只读。"
          >
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码（选填，留空将自动生成 12 位随机串）"
            rules={[
              {
                validator: (_, val) => {
                  if (!val) return Promise.resolve();
                  if (val.length < 6) return Promise.reject(new Error('至少 6 位'));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input.Password placeholder="留空 → 自动生成并展示" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="remark" label="备注（选填）" rules={[{ max: 128 }]}>
            <Input placeholder="如朋友姓名、用途说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑账号 */}
      <Modal
        title={editing ? `编辑账号 ${editing.username}` : '编辑账号'}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={async () => {
          if (!editing) return;
          const v = await editForm.validateFields();
          const data: any = {
            remark: v.remark ?? null,
          };
          if (v.role && v.role !== editing.role) data.role = v.role;
          if (v.new_password?.trim()) data.new_password = v.new_password.trim();
          updateMut.mutate({ id: editing.id, data });
        }}
        confirmLoading={updateMut.isPending}
        destroyOnClose
        okText="保存"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item name="remark" label="备注" rules={[{ max: 128 }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="设置新密码（选填）"
            extra="留空则不修改密码；如需自动生成请使用「重置密码」按钮"
            rules={[
              {
                validator: (_, val) => {
                  if (!val) return Promise.resolve();
                  if (val.length < 6) return Promise.reject(new Error('至少 6 位'));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input.Password placeholder="留空保持原密码" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 凭证展示 */}
      <Modal
        title="账号凭证"
        open={!!credModal}
        onCancel={() => setCredModal(null)}
        onOk={() => setCredModal(null)}
        okText="我已记录"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Typography.Paragraph type="warning">
          以下密码<strong>仅展示一次</strong>，请立即复制并安全交付：
        </Typography.Paragraph>
        {credModal && (
          <>
            <div>用户名：</div>
            <Typography.Paragraph copyable code>
              {credModal.username}
            </Typography.Paragraph>
            <div>密码：</div>
            <Typography.Paragraph copyable code style={{ fontSize: 16 }}>
              {credModal.initial_password}
            </Typography.Paragraph>
            <div>角色：</div>
            <Typography.Paragraph code>{credModal.role}</Typography.Paragraph>
          </>
        )}
      </Modal>
    </div>
  );
}
