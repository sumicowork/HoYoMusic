import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ImportOutlined, PlusOutlined } from '@ant-design/icons';
import AdminLayout from '../components/AdminLayout';
import MusicSourceImportModal from '../components/MusicSourceImportModal';
import { gameService, type Game } from '../services/gameService';
import {
  musicSourceService,
  type MusicSourceCategory,
  type MusicSourceNode,
} from '../services/musicSourceService';

const { Title, Text } = Typography;

interface NodeRow extends MusicSourceNode {
  depth: number;
  pathText: string;
}

const MusicSourceLibraryManagement: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [categories, setCategories] = useState<MusicSourceCategory[]>([]);
  const [nodes, setNodes] = useState<MusicSourceNode[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [loadingGames, setLoadingGames] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingNodes, setLoadingNodes] = useState(false);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MusicSourceCategory | null>(null);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryForm] = Form.useForm();

  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<MusicSourceNode | null>(null);
  const [nodeSubmitting, setNodeSubmitting] = useState(false);
  const [nodeForm] = Form.useForm();
  const [importModalOpen, setImportModalOpen] = useState(false);

  const gameOptions = useMemo(
    () => games.map((game) => ({ label: game.name, value: game.id })),
    [games]
  );

  const categoryLookup = useMemo(() => {
    const map = new Map<number, MusicSourceCategory>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  const nodeLookup = useMemo(() => {
    const map = new Map<number, MusicSourceNode>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  const buildNodePath = (node: MusicSourceNode): string[] => {
    const segments = [node.name];
    let parentId = node.parent_id;
    const guard = new Set<number>();
    while (parentId != null && !guard.has(parentId)) {
      guard.add(parentId);
      const parent = nodeLookup.get(parentId);
      if (!parent) break;
      segments.unshift(parent.name);
      parentId = parent.parent_id;
    }
    return segments;
  };

  const nodeRows = useMemo<NodeRow[]>(() => {
    return nodes
      .map((node) => {
        const pathSegments = buildNodePath(node);
        return {
          ...node,
          depth: Math.max(0, pathSegments.length - 1),
          pathText: pathSegments.join(' / '),
        };
      })
      .sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return a.name.localeCompare(b.name);
      });
  }, [nodes, nodeLookup]);

  const nodeParentOptions = useMemo(
    () => [
      { label: '根节点（无 parent）', value: '__root__' },
      ...nodeRows.map((row) => ({ label: row.pathText, value: String(row.id) })),
    ],
    [nodeRows]
  );

  const loadGames = async () => {
    setLoadingGames(true);
    try {
      const result = await gameService.getGames();
      setGames(result);
      if (result.length > 0) {
        setSelectedGameId((current) => current ?? result[0].id);
      }
    } catch (error: any) {
      message.error(error?.message || '加载游戏列表失败');
    } finally {
      setLoadingGames(false);
    }
  };

  const loadCategories = async (gameId: number) => {
    setLoadingCategories(true);
    try {
      const result = await musicSourceService.getCategories(gameId);
      setCategories(result);
      setSelectedCategoryId((current) => {
        if (current && result.some((item) => item.id === current)) return current;
        return result[0]?.id ?? null;
      });
    } catch (error: any) {
      message.error(error?.message || '加载分类失败');
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadAllNodes = async (gameId: number, categoryId: number) => {
    setLoadingNodes(true);
    try {
      const collected: MusicSourceNode[] = [];
      const queue: Array<number | null> = [null];

      while (queue.length > 0) {
        const parentId = queue.shift() ?? null;
        const children = await musicSourceService.getNodes(gameId, categoryId, parentId === null ? undefined : parentId);
        collected.push(...children);
        children.forEach((child) => queue.push(child.id));
      }

      setNodes(collected);
    } catch (error: any) {
      message.error(error?.message || '加载路径节点失败');
    } finally {
      setLoadingNodes(false);
    }
  };

  useEffect(() => {
    void loadGames();
  }, []);

  useEffect(() => {
    if (!selectedGameId) return;
    void loadCategories(selectedGameId);
  }, [selectedGameId]);

  useEffect(() => {
    if (!selectedGameId || !selectedCategoryId) {
      setNodes([]);
      return;
    }
    void loadAllNodes(selectedGameId, selectedCategoryId);
  }, [selectedGameId, selectedCategoryId]);

  const openCreateCategory = () => {
    if (!selectedGameId) {
      message.warning('请先选择游戏');
      return;
    }
    setEditingCategory(null);
    categoryForm.resetFields();
    categoryForm.setFieldsValue({ display_order: categories.length });
    setCategoryModalOpen(true);
  };

  const openEditCategory = (category: MusicSourceCategory) => {
    setEditingCategory(category);
    categoryForm.setFieldsValue({
      name: category.name,
      description: category.description,
      display_order: category.display_order,
    });
    setCategoryModalOpen(true);
  };

  const submitCategory = async () => {
    if (!selectedGameId) return;
    try {
      const values = await categoryForm.validateFields();
      setCategorySubmitting(true);
      if (editingCategory) {
        await musicSourceService.updateCategory(editingCategory.id, values);
        message.success('分类已更新');
      } else {
        await musicSourceService.createCategory({ game_id: selectedGameId, ...values });
        message.success('分类已创建');
      }
      setCategoryModalOpen(false);
      await loadCategories(selectedGameId);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '保存分类失败');
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    if (!selectedGameId) return;
    try {
      await musicSourceService.deleteCategory(categoryId);
      message.success('分类已删除');
      await loadCategories(selectedGameId);
    } catch (error: any) {
      message.error(error?.message || '删除分类失败');
    }
  };

  const openCreateNode = () => {
    if (!selectedCategoryId) {
      message.warning('请先选择分类');
      return;
    }
    setEditingNode(null);
    nodeForm.resetFields();
    nodeForm.setFieldsValue({ parent_id: '__root__', display_order: nodes.length });
    setNodeModalOpen(true);
  };

  const openEditNode = (node: MusicSourceNode) => {
    setEditingNode(node);
    nodeForm.setFieldsValue({
      name: node.name,
      parent_id: node.parent_id == null ? '__root__' : String(node.parent_id),
      display_order: node.display_order,
    });
    setNodeModalOpen(true);
  };

  const submitNode = async () => {
    if (!selectedGameId || !selectedCategoryId) return;
    try {
      const values = await nodeForm.validateFields();
      const parentId = values.parent_id === '__root__' ? null : Number(values.parent_id);
      const payload = {
        name: values.name,
        display_order: values.display_order,
      };

      setNodeSubmitting(true);
      if (editingNode) {
        await musicSourceService.updateNode(editingNode.id, payload);
        message.success('路径节点已更新');
      } else {
        await musicSourceService.createNode({
          game_id: selectedGameId,
          category_id: selectedCategoryId,
          parent_id: parentId,
          ...payload,
        });
        message.success('路径节点已创建');
      }
      setNodeModalOpen(false);
      await loadAllNodes(selectedGameId, selectedCategoryId);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '保存路径节点失败');
    } finally {
      setNodeSubmitting(false);
    }
  };

  const handleDeleteNode = async (nodeId: number) => {
    if (!selectedGameId || !selectedCategoryId) return;
    try {
      await musicSourceService.deleteNode(nodeId);
      message.success('路径节点已删除');
      await loadAllNodes(selectedGameId, selectedCategoryId);
    } catch (error: any) {
      message.error(error?.message || '删除路径节点失败');
    }
  };

  const categoryColumns: ColumnsType<MusicSourceCategory> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '分类名', dataIndex: 'name' },
    { title: '排序', dataIndex: 'display_order', width: 90 },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEditCategory(row)}>编辑</Button>
          <Popconfirm title="确认删除该分类？" onConfirm={() => handleDeleteCategory(row.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const nodeColumns: ColumnsType<NodeRow> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    {
      title: '路径',
      key: 'path',
      render: (_, row) => (
        <Space>
          <Tag color="blue">L{row.depth}</Tag>
          <span>{row.pathText}</span>
        </Space>
      ),
    },
    { title: '排序', dataIndex: 'display_order', width: 90 },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEditNode(row)}>编辑</Button>
          <Popconfirm title="确认删除该路径节点？其子节点会一起删除。" onConfirm={() => handleDeleteNode(row.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <Title level={3}>Music Source 分类/路径管理</Title>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Card>
            <Space wrap>
              <Text strong>选择游戏</Text>
              <Select
                loading={loadingGames}
                style={{ minWidth: 240 }}
                options={gameOptions}
                value={selectedGameId ?? undefined}
                onChange={(value) => setSelectedGameId(value)}
                placeholder="请选择游戏"
              />
              <Button icon={<ImportOutlined />} type="primary" onClick={() => setImportModalOpen(true)}>
                批量导入 Music Source
              </Button>
            </Space>
          </Card>

          <Alert
            type="info"
            showIcon
            message="导入行为已调整：当导入数据中的 category/path 不存在时，提交阶段会自动按顺序创建，不再阻断。"
          />

          <Card
            title="分类（Category）"
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreateCategory}>新建分类</Button>}
            loading={loadingCategories}
          >
            <Table<MusicSourceCategory>
              rowKey="id"
              size="small"
              columns={categoryColumns}
              dataSource={categories}
              pagination={false}
              rowSelection={{
                type: 'radio',
                selectedRowKeys: selectedCategoryId ? [selectedCategoryId] : [],
                onChange: (selectedRowKeys) => {
                  const first = selectedRowKeys[0] as number | undefined;
                  setSelectedCategoryId(first ?? null);
                },
              }}
            />
          </Card>

          <Card
            title={`路径节点（Path）${selectedCategoryId ? ` - ${categoryLookup.get(selectedCategoryId)?.name || ''}` : ''}`}
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreateNode} disabled={!selectedCategoryId}>新建节点</Button>}
            loading={loadingNodes}
          >
            <Table<NodeRow>
              rowKey="id"
              size="small"
              columns={nodeColumns}
              dataSource={nodeRows}
              pagination={false}
              scroll={{ x: 860 }}
            />
          </Card>
        </Space>
      </div>

      <Modal
        title={editingCategory ? '编辑分类' : '新建分类'}
        open={categoryModalOpen}
        onCancel={() => setCategoryModalOpen(false)}
        onOk={submitCategory}
        confirmLoading={categorySubmitting}
        destroyOnHidden
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item name="name" label="分类名" rules={[{ required: true, message: '请输入分类名' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} maxLength={1000} />
          </Form.Item>
          <Form.Item name="display_order" label="排序" initialValue={0}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingNode ? '编辑路径节点' : '新建路径节点'}
        open={nodeModalOpen}
        onCancel={() => setNodeModalOpen(false)}
        onOk={submitNode}
        confirmLoading={nodeSubmitting}
        destroyOnHidden
      >
        <Form form={nodeForm} layout="vertical">
          {!editingNode ? (
            <Form.Item name="parent_id" label="父节点" initialValue="__root__">
              <Select options={nodeParentOptions} />
            </Form.Item>
          ) : null}
          <Form.Item name="name" label="节点名" rules={[{ required: true, message: '请输入节点名' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="display_order" label="排序" initialValue={0}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <MusicSourceImportModal
        visible={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          if (selectedGameId) {
            void loadCategories(selectedGameId);
          }
          if (selectedGameId && selectedCategoryId) {
            void loadAllNodes(selectedGameId, selectedCategoryId);
          }
        }}
      />
    </AdminLayout>
  );
};

export default MusicSourceLibraryManagement;


