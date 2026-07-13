# legado-shelf

[Legado](https://github.com/gedoor/legado)（开源阅读）的云端书架。提供 Web 管理界面，可将本地 EPUB/TXT 上传至 GitHub Release 存储，通过定制书源随时在线阅读。

## 特性

- **Web 管理** — 拖拽上传 EPUB/TXT，编辑元数据，封面自动转 JPEG
- **GitHub 存储** — 书籍按章节分片存入 GitHub Release，自动生成索引
- **Cloudflare 驱动** — Worker + R2 全栈部署，全球边缘加速，无需服务器
- **API 接口** — 搜索、目录、章节内容、封面，可接入自定书源

## 一键部署

部署教程见 [docs/deploy.md](docs/deploy.md)。

## 本地开发

```bash
git clone https://github.com/你的用户名/legado-shelf.git
cd legado-shelf
npm install
cp .dev.vars.example .dev.vars   # 编辑填入配置
npm run dev
```

浏览器打开 `http://localhost:5173`，输入 API Key。

## 架构

```
前端 (Vue 3)  ──→  Cloudflare Worker  ──→  GitHub API
                       │
                  Cloudflare R2        GitHub Actions
                  (上传暂存)            (Release 生成)
```

## 技术栈

- Vue 3 + Vue Router + TypeScript
- Cloudflare Workers + R2
- GitHub Actions + Octokit
- JSZip + aws4fetch
