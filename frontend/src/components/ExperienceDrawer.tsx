import { useEffect, useState } from 'react';
import { Drawer, Form, Input, Select, Upload, Button, Space, App as AntdApp } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';

import { experienceApi } from '@/api';
import type { CategoryOut, ExperienceOut, GroupOut } from '@/api/types';
import { useIsMobile } from '@/hooks/useMediaQuery';
import CoverPicker from './CoverPicker';

interface Props {
  open: boolean;
  experience: ExperienceOut | null;
  categories: CategoryOut[];
  groups: GroupOut[]; // 当前 Tab 下的所有分组
  defaultCategoryId: string;
  onClose: () => void;
  onSaved: () => void;
}

const NONE_VALUE = '__none__';

export default function ExperienceDrawer({
  open,
  experience,
  categories,
  groups,
  defaultCategoryId,
  onClose,
  onSaved,
}: Props) {
  const [form] = Form.useForm();
  const isEdit = !!experience;
  const { message } = AntdApp.useApp();
  const isMobile = useIsMobile();

  // 封面：上传文件 / 预设 二选一
  const [coverFiles, setCoverFiles] = useState<any[]>([]);
  const [coverPreset, setCoverPreset] = useState<string | null>(null);

  // 当前选择的分类（用于过滤分组下拉）
  const watchedCategoryId = Form.useWatch('category_id', form) ?? defaultCategoryId;
  const filteredGroups = groups.filter((g) => g.category_id === watchedCategoryId);

  useEffect(() => {
    if (open) {
      if (experience) {
        form.setFieldsValue({
          title: experience.title,
          summary: experience.summary ?? '',
          category_id: experience.category_id,
          group_id: experience.group_id ?? NONE_VALUE,
          html_file: [],
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ category_id: defaultCategoryId, group_id: NONE_VALUE });
      }
      // 重置封面选择
      setCoverFiles([]);
      setCoverPreset(null);
    }
  }, [open, experience, defaultCategoryId, form]);

  // 切换分类时重置分组（避免分组与分类不匹配）
  useEffect(() => {
    if (!open) return;
    const currentGroupId = form.getFieldValue('group_id');
    if (currentGroupId && currentGroupId !== NONE_VALUE) {
      const stillValid = groups.find(
        (g) => g.id === currentGroupId && g.category_id === watchedCategoryId,
      );
      if (!stillValid) form.setFieldValue('group_id', NONE_VALUE);
    }
  }, [watchedCategoryId, open, groups, form]);

  const saveMut = useMutation({
    mutationFn: async (values: any) => {
      const fd = new FormData();
      if (values.title !== undefined) fd.append('title', values.title);
      if (values.summary !== undefined) fd.append('summary', values.summary ?? '');
      if (values.category_id) fd.append('category_id', values.category_id);

      // 分组：__none__ 在编辑模式下用 clear_group=1 显式清空；新增模式下省略即可
      const gid = values.group_id;
      if (gid && gid !== NONE_VALUE) {
        fd.append('group_id', gid);
      } else if (isEdit) {
        fd.append('clear_group', '1');
      }

      const htmlFile = values.html_file?.[0]?.originFileObj;
      if (htmlFile) fd.append('html_file', htmlFile);

      // 封面：上传文件优先；否则用预设
      const coverFile = coverFiles?.[0]?.originFileObj;
      if (coverFile) {
        fd.append('cover_file', coverFile);
      } else if (coverPreset) {
        fd.append('cover_preset', coverPreset);
      }

      if (isEdit) return experienceApi.update(experience!.id, fd);
      return experienceApi.create(fd);
    },
    onSuccess: () => {
      message.success(isEdit ? '已保存' : '已创建');
      onSaved();
    },
  });

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!isEdit && !values.html_file?.[0]?.originFileObj) {
        message.error('请上传 HTML 文档');
        return;
      }
      await saveMut.mutateAsync(values);
    } catch {
      // 校验失败已显示
    }
  };

  const normFile = (e: any) => (Array.isArray(e) ? e : e?.fileList ?? []);

  return (
    <Drawer
      title={isEdit ? '编辑经验' : '新增经验'}
      width={isMobile ? '100vw' : 520}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saveMut.isPending} onClick={handleSubmit}>
            保存
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入标题' }, { max: 120 }]}
        >
          <Input placeholder="例：仓位管理 - 凯利公式实操" maxLength={120} showCount />
        </Form.Item>

        <Form.Item name="summary" label="简介" rules={[{ max: 255 }]}>
          <Input.TextArea rows={3} maxLength={255} showCount placeholder="选填，一句话概括" />
        </Form.Item>

        <Form.Item
          name="category_id"
          label="所属分类"
          rules={[{ required: true, message: '请选择分类' }]}
        >
          <Select
            options={categories.map((c) => ({
              label: `${c.icon ?? ''} ${c.name}`,
              value: c.id,
            }))}
          />
        </Form.Item>

        <Form.Item name="group_id" label="子分组" extra="选填，未选则归入「未分组」">
          <Select
            options={[
              { label: '— 未分组 —', value: NONE_VALUE },
              ...filteredGroups.map((g) => ({
                label: `${g.icon ?? ''} ${g.name}`.trim(),
                value: g.id,
              })),
            ]}
          />
        </Form.Item>

        <Form.Item
          name="html_file"
          label={isEdit ? 'HTML 文档（选填，留空保留原文件）' : 'HTML 文档'}
          valuePropName="fileList"
          getValueFromEvent={normFile}
          rules={isEdit ? [] : [{ required: true, message: '请上传 HTML 文件' }]}
        >
          <Upload.Dragger accept=".html,.htm" maxCount={1} beforeUpload={() => false}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽 .html 文件到此处</p>
            <p className="ant-upload-hint">单文件 ≤ 20MB</p>
          </Upload.Dragger>
        </Form.Item>

        <Form.Item label="封面图（选填）" extra="可上传图片，或选择下方赛博朋克风预设">
          <CoverPicker
            fileList={coverFiles}
            onFileListChange={setCoverFiles}
            presetKey={coverPreset}
            onPresetChange={setCoverPreset}
            hasExistingCover={!!experience?.has_cover}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
