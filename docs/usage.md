# 使用

## 上传管理书籍

提供简单可视化网页用来日常上传、管理书籍

1. 打开 Cloudflare 分配的域名或自己绑定的域名，输入 `API_KEY` 登录
2. 上传 EPUB / TXT 文件
3. 编辑元数据后点击"确认上传"
4. 点击"触发处理"启动 Action 生成 Release

## 阅读

<p align="center">
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://raw.githubusercontent.com/2061360308/legado-shelf/main/support/legado/bookSource.json" alt="legado-shelf书源二维码">
  <h5 align="center">开源阅读书源【legado-shelf】二维码</h5>
</p>

基于 API 设计了开源阅读的书源，扫描上方二维码或者复制[`bookSource.json`](../support/legado/bookSource.json)中的内容添加书源，之后就可以在发现书源中找到`legado-shelf`这个书源，登录后点击我的书籍即可看到自己上传的书。

## API

项目部署后，所有 API 如下，不必局限于以上使用方式，可以自行拓展

> 所有 API 需要 `Authorization: Bearer {API_KEY}` 头部。

| 接口                                 | 说明          |
| ------------------------------------ | ------------- |
| `GET /api/books?q=关键词`            | 搜索/列出书籍 |
| `GET /api/books/:hash/toc`           | 书籍目录      |
| `GET /api/books/:hash/cover`         | 封面          |
| `GET /api/books/:hash/chapters/:key` | 章节内容      |
