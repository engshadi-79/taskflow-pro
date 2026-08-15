"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  saveFlowCanvas,
  publishFlowVersion,
  createFlowVersion,
  toggleFlowActive,
  runFlowTest,
} from "@/lib/actions/workflow-flows";
import {
  NODE_TYPE_LABEL,
  TRIGGER_EVENT_LABEL,
  type FlowNodeType,
  type FlowTriggerEvent,
  type WorkflowFlow,
  type WorkflowFlowNode,
  type WorkflowFlowEdge,
} from "@/lib/types/workflow-flow";
import { PRIORITY_LABEL, type Priority } from "@/lib/types/task";

const NODE_COLORS: Record<FlowNodeType, string> = {
  trigger: "#6366f1",
  condition: "#f59e0b",
  create_task: "#10b981",
  assign: "#0ea5e9",
  notification: "#ec4899",
  delay: "#8b5cf6",
  approval: "#ef4444",
};

const ADDABLE_NODE_TYPES: FlowNodeType[] = [
  "condition",
  "create_task",
  "assign",
  "notification",
  "delay",
  "approval",
];

type NodeData = { node_type: FlowNodeType; config: Record<string, string>; isNew: boolean };

function summarize(nodeType: FlowNodeType, config: Record<string, string>): string {
  switch (nodeType) {
    case "trigger":
      return config.event ? TRIGGER_EVENT_LABEL[config.event as FlowTriggerEvent] ?? config.event : "لم يُحدَّد الحدث";
    case "condition":
      return config.field ? `${config.field} ${config.operator ?? "eq"} ${config.value ?? ""}` : "بلا شرط";
    case "create_task":
      return config.title || "بلا عنوان";
    case "assign":
      return config.assign_to === "department_manager" ? "لمدير القسم" : config.assign_to ? "لموظف محدَّد" : "غير محدَّد";
    case "notification":
      return config.message || "بلا نص";
    case "delay":
      return config.hours ? `${config.hours} ساعة` : "غير محدَّد";
    case "approval":
      return config.approver_type === "specific_user" ? "شخص محدَّد" : "مدير القسم";
    default:
      return "";
  }
}

function FlowNodeBox({ data, selected }: NodeProps) {
  const d = data as unknown as NodeData;
  const color = NODE_COLORS[d.node_type];
  return (
    <div
      style={{ borderColor: color }}
      className={`min-w-[160px] rounded-[12px] border-2 bg-surface px-3 py-2.5 text-[12.5px] shadow-md ${selected ? "ring-2 ring-accent-500" : ""}`}
    >
      {d.node_type !== "trigger" && <Handle type="target" position={Position.Right} />}
      <div className="flex items-center gap-1.5 font-extrabold" style={{ color }}>
        {NODE_TYPE_LABEL[d.node_type]}
      </div>
      <div className="mt-0.5 truncate text-[11px] text-muted">{summarize(d.node_type, d.config)}</div>
      {d.node_type === "condition" ? (
        <>
          <Handle type="source" position={Position.Left} id="true" style={{ top: "35%", background: "#22c55e" }} />
          <Handle type="source" position={Position.Left} id="false" style={{ top: "65%", background: "#ef4444" }} />
        </>
      ) : (
        <Handle type="source" position={Position.Left} />
      )}
    </div>
  );
}

const nodeTypes = { flowNode: FlowNodeBox };
const inputClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent-500";

export function WorkflowFlowCanvas({
  flow,
  initialNodes,
  initialEdges,
  employees,
}: {
  flow: WorkflowFlow;
  initialNodes: WorkflowFlowNode[];
  initialEdges: WorkflowFlowEdge[];
  employees: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const isEditable = flow.status === "draft";

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>(
    initialNodes.map((n) => ({
      id: n.id,
      type: "flowNode",
      position: { x: n.position_x, y: n.position_y },
      data: { node_type: n.node_type, config: n.config, isNew: false },
    }))
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialEdges.map((e) => ({
      id: e.id,
      source: e.from_node_id,
      target: e.to_node_id,
      sourceHandle: e.condition_branch,
      label: e.condition_branch === "true" ? "نعم" : e.condition_branch === "false" ? "لا" : undefined,
      style: e.condition_branch === "false" ? { stroke: "#ef4444" } : e.condition_branch === "true" ? { stroke: "#22c55e" } : undefined,
    }))
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testEntityId, setTestEntityId] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isEditable) return;
      const branch = connection.sourceHandle === "true" || connection.sourceHandle === "false" ? connection.sourceHandle : null;
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: crypto.randomUUID(),
            label: branch === "true" ? "نعم" : branch === "false" ? "لا" : undefined,
            style: branch === "false" ? { stroke: "#ef4444" } : branch === "true" ? { stroke: "#22c55e" } : undefined,
          },
          eds
        )
      );
    },
    [isEditable, setEdges]
  );

  function addNode(nodeType: FlowNodeType) {
    if (!isEditable) return;
    const id = crypto.randomUUID();
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "flowNode",
        position: { x: 250 + Math.random() * 100, y: 100 + nds.length * 90 },
        data: { node_type: nodeType, config: {}, isNew: true },
      },
    ]);
  }

  function updateSelectedConfig(patch: Record<string, string>) {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } } : n))
    );
  }

  function deleteSelected() {
    if (!selectedId || !isEditable) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await saveFlowCanvas(
      flow.id,
      nodes.map((n) => ({
        id: n.id,
        isNew: n.data.isNew,
        node_type: n.data.node_type,
        position_x: n.position.x,
        position_y: n.position.y,
        config: n.data.config,
      })),
      edges.map((e) => ({
        from_node_id: e.source,
        to_node_id: e.target,
        condition_branch: (e.sourceHandle === "true" || e.sourceHandle === "false" ? e.sourceHandle : null) as
          | "true"
          | "false"
          | null,
      }))
    );
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handlePublish() {
    setError(null);
    await handleSave();
    const result = await publishFlowVersion(flow.id);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  async function handleNewVersion() {
    setError(null);
    const result = await createFlowVersion(flow.id);
    if (result?.error) setError(result.error);
    else if (result.newId) router.push(`/dashboard/workflow-builder/${result.newId}`);
  }

  async function handleToggleActive() {
    setError(null);
    const result = await toggleFlowActive(flow.id, !flow.is_active);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  async function handleRunTest() {
    if (!testEntityId.trim()) {
      setError("أدخل معرّف مهمة لاختبار سير العمل عليها");
      return;
    }
    setTesting(true);
    setError(null);
    setTestResult(null);
    const result = await runFlowTest(flow.id, "task", testEntityId.trim());
    setTesting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setTestResult("تم تشغيل الاختبار - راجع سجل التنفيذ أدناه بعد تحديث الصفحة");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-border bg-surface p-3">
        <span className="text-[12.5px] font-bold text-foreground">
          {flow.name} — الإصدار {flow.version} ({flow.status === "draft" ? "مسودة" : "منشور"})
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${flow.is_active ? "bg-green-50 text-green-600" : "bg-border text-muted"}`}>
          {flow.is_active ? "فعّال" : "معطَّل"}
        </span>
        <div className="flex-1" />
        {isEditable && (
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-md border border-border px-3 py-1.5 text-[12.5px] font-bold text-foreground hover:bg-background disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        )}
        {isEditable && (
          <button
            type="button"
            onClick={handlePublish}
            className="rounded-md bg-accent-500 px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-accent-600"
          >
            نشر هذا الإصدار
          </button>
        )}
        {!isEditable && (
          <button
            type="button"
            onClick={handleNewVersion}
            className="rounded-md border border-border px-3 py-1.5 text-[12.5px] font-bold text-foreground hover:bg-background"
          >
            إنشاء نسخة جديدة للتعديل
          </button>
        )}
        {flow.status === "published" && (
          <button
            type="button"
            onClick={handleToggleActive}
            className={`rounded-md border px-3 py-1.5 text-[12.5px] font-bold ${
              flow.is_active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"
            }`}
          >
            {flow.is_active ? "تعطيل" : "تفعيل"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px]">
        <div dir="ltr" className="h-[520px] overflow-hidden rounded-[14px] border border-border bg-background">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={isEditable ? onNodesChange : undefined}
            onEdgesChange={isEditable ? onEdgesChange : undefined}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            nodesDraggable={isEditable}
            nodesConnectable={isEditable}
            elementsSelectable={isEditable}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
            {isEditable && (
              <Panel position="top-left">
                <div className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-surface p-2">
                  <span className="px-1 text-[11px] font-bold text-faint">أضف خطوة</span>
                  {ADDABLE_NODE_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addNode(t)}
                      style={{ borderColor: NODE_COLORS[t] }}
                      className="rounded-md border px-2.5 py-1 text-start text-[11.5px] font-bold text-foreground hover:bg-background"
                    >
                      {NODE_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        <div className="space-y-3">
          <div className="rounded-[14px] border border-border bg-surface p-3">
            <h3 className="mb-2 text-[12.5px] font-extrabold text-foreground">إعداد الخطوة</h3>
            {!selectedNode && <p className="text-[12px] text-muted">اختر خطوة من الرسم لتعديل إعداداتها</p>}
            {selectedNode && (
              <NodeConfigForm
                nodeType={selectedNode.data.node_type}
                config={selectedNode.data.config}
                employees={employees}
                editable={isEditable}
                onChange={updateSelectedConfig}
              />
            )}
            {selectedNode && isEditable && selectedNode.data.node_type !== "trigger" && (
              <button
                type="button"
                onClick={deleteSelected}
                className="mt-3 w-full rounded-md border border-red-200 px-3 py-1.5 text-[12px] font-bold text-red-600 hover:bg-red-50"
              >
                حذف هذه الخطوة
              </button>
            )}
          </div>

          {flow.status === "published" && (
            <div className="rounded-[14px] border border-border bg-surface p-3">
              <h3 className="mb-2 text-[12.5px] font-extrabold text-foreground">تشغيل اختبار</h3>
              <input
                value={testEntityId}
                onChange={(e) => setTestEntityId(e.target.value)}
                placeholder="معرّف مهمة (UUID)"
                className={inputClass}
              />
              <button
                type="button"
                disabled={testing}
                onClick={handleRunTest}
                className="mt-2 w-full rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-accent-600 disabled:opacity-60"
              >
                {testing ? "جارٍ التشغيل..." : "تشغيل على هذه المهمة"}
              </button>
              {testResult && <p className="mt-2 text-[11.5px] text-green-600">{testResult}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NodeConfigForm({
  nodeType,
  config,
  employees,
  editable,
  onChange,
}: {
  nodeType: FlowNodeType;
  config: Record<string, string>;
  employees: { id: string; full_name: string }[];
  editable: boolean;
  onChange: (patch: Record<string, string>) => void;
}) {
  const disabled = !editable;

  if (nodeType === "trigger") {
    return (
      <label className="block">
        <span className="mb-1 block text-[11.5px] text-muted">الحدث</span>
        <select
          disabled={disabled}
          value={config.event ?? ""}
          onChange={(e) => onChange({ event: e.target.value })}
          className={inputClass}
        >
          <option value="">اختر حدثًا</option>
          {(Object.keys(TRIGGER_EVENT_LABEL) as FlowTriggerEvent[]).map((ev) => (
            <option key={ev} value={ev}>{TRIGGER_EVENT_LABEL[ev]}</option>
          ))}
        </select>
      </label>
    );
  }

  if (nodeType === "condition") {
    return (
      <div className="space-y-2">
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">الحقل</span>
          <select disabled={disabled} value={config.field ?? ""} onChange={(e) => onChange({ field: e.target.value })} className={inputClass}>
            <option value="">اختر</option>
            <option value="priority">الأولوية</option>
            <option value="status">الحالة</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">المقارنة</span>
          <select disabled={disabled} value={config.operator ?? "eq"} onChange={(e) => onChange({ operator: e.target.value })} className={inputClass}>
            <option value="eq">يساوي</option>
            <option value="neq">لا يساوي</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">القيمة</span>
          <input disabled={disabled} value={config.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} className={inputClass} />
        </label>
      </div>
    );
  }

  if (nodeType === "create_task") {
    return (
      <div className="space-y-2">
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">عنوان المهمة</span>
          <input disabled={disabled} value={config.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">تُسنَد إلى</span>
          <select disabled={disabled} value={config.assign_to ?? ""} onChange={(e) => onChange({ assign_to: e.target.value })} className={inputClass}>
            <option value="">نفس صاحب المهمة الأصلية</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">الأولوية</span>
          <select disabled={disabled} value={config.priority ?? "medium"} onChange={(e) => onChange({ priority: e.target.value })} className={inputClass}>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (nodeType === "assign") {
    return (
      <label className="block">
        <span className="mb-1 block text-[11.5px] text-muted">التعيين إلى</span>
        <select disabled={disabled} value={config.assign_to ?? ""} onChange={(e) => onChange({ assign_to: e.target.value })} className={inputClass}>
          <option value="">اختر</option>
          <option value="department_manager">مدير القسم</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.full_name}</option>
          ))}
        </select>
      </label>
    );
  }

  if (nodeType === "notification") {
    return (
      <div className="space-y-2">
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">المستلم</span>
          <select disabled={disabled} value={config.target ?? ""} onChange={(e) => onChange({ target: e.target.value })} className={inputClass}>
            <option value="">اختر</option>
            <option value="trigger_actor">صاحب المهمة</option>
            <option value="department_manager">مدير القسم</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">نص الإشعار</span>
          <textarea disabled={disabled} value={config.message ?? ""} onChange={(e) => onChange({ message: e.target.value })} rows={2} className={inputClass} />
        </label>
      </div>
    );
  }

  if (nodeType === "delay") {
    return (
      <label className="block">
        <span className="mb-1 block text-[11.5px] text-muted">التأخير (بالساعات)</span>
        <input
          disabled={disabled}
          type="number"
          min={1}
          value={config.hours ?? ""}
          onChange={(e) => onChange({ hours: e.target.value })}
          className={inputClass}
        />
      </label>
    );
  }

  if (nodeType === "approval") {
    return (
      <div className="space-y-2">
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">الموافِق</span>
          <select
            disabled={disabled}
            value={config.approver_type ?? "department_manager"}
            onChange={(e) => onChange({ approver_type: e.target.value })}
            className={inputClass}
          >
            <option value="department_manager">مدير القسم</option>
            <option value="specific_user">شخص محدَّد</option>
          </select>
        </label>
        {config.approver_type === "specific_user" && (
          <label className="block">
            <span className="mb-1 block text-[11.5px] text-muted">الشخص</span>
            <select
              disabled={disabled}
              value={config.approver_user_id ?? ""}
              onChange={(e) => onChange({ approver_user_id: e.target.value })}
              className={inputClass}
            >
              <option value="">اختر</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    );
  }

  return null;
}
