# chart-bot

左侧对话 + 右侧 3D-1 图表画布的 Bot Demo。

## 目录

- `server/`：后端（会话状态、意图路由、LLM 调用）
- `web/`：前端（聊天 UI、3D-1 渲染）

## LLM 接入说明

- 当前已接入方舟（Ark）作为 LLM：当 `server` 进程存在环境变量 `ARK_API_KEY` 时，会在 GENERATE/CONVERT/MODIFY 的“规则无法稳定解析”场景下调用 LLM。
- 如果没有配置 `ARK_API_KEY`，GENERATE 会回退到本地的 dummy spec（看起来像“写死数据”），用于保证 Demo 可离线跑通。
- `POST /api/chat` 的响应里会带 `meta.llm_used`（仅 GENERATE 目前返回），用来判断本次是否真的走了 LLM。
